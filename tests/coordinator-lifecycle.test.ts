import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createIsolatedDaemon } from "./isolated-daemon.ts";

type Daemon = Awaited<ReturnType<typeof createIsolatedDaemon>>;
const explicit = {
  provider: "bot-test",
  model: "test-model",
  modeId: "approve",
  thinkingOptionId: "brief",
};
async function setup(daemon: Daemon) {
  await daemon.client.config.patch({
    agentProfiles: [{ id: "source", name: "Source", ...explicit }],
  });
  const ready = z
    .object({ profile: z.object({ id: z.string() }) })
    .parse(
      await daemon.rpc("prepare-coordinator", { sourceProfileId: "source" }),
    );
  const { workspaceId } = z
    .object({ workspaceId: z.string() })
    .parse(await daemon.rpc("open-workspace", {}));
  return { profileId: ready.profile.id, workspaceId };
}
async function inspect(daemon: Daemon, id: string) {
  const agent = daemon.client.agents.ref(id);
  await agent.waitForFinish(10000);
  const page = await agent.timeline.refetch();
  const reply = [...page.entries]
    .reverse()
    .find(({ item }) => item.type === "assistant_message");
  assert.ok(reply?.item.type === "assistant_message");
  return JSON.parse(reply.item.text);
}
async function native(daemon: Daemon, workspaceId: string) {
  return daemon.client.workspaces.ref(workspaceId).agents.create({
    config: { ...explicit, provider: "bot-test/test-model" },
    prompt: "inspect-bot-config",
  });
}
async function legacy(daemon: Daemon) {
  return daemon.rpc("create-conversation", {
    requestId: randomUUID(),
    text: "inspect-bot-config",
    config: explicit,
  });
}
async function cli(daemon: Daemon, args: string[]) {
  await promisify(execFile)(
    "paseo",
    [...args, "--home", daemon.home, "--json"],
    {
      env: Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) => !key.startsWith("PASEO_"),
        ),
      ),
      timeout: 20000,
    },
  );
}

test("new native and legacy sessions use edited and cleared notes after reload without rewriting prior sessions", {
  timeout: 90000,
}, async () => {
  const daemon = await createIsolatedDaemon({
    fixture: true,
    configFaults: true,
  });
  try {
    const { profileId, workspaceId } = await setup(daemon);
    const prior = await native(daemon, workspaceId);
    const original = await inspect(daemon, prior.id);
    const profiles =
      (await daemon.client.config.get()).config.agentProfiles ?? [];
    const edited = profiles.map((p) =>
      p.id === profileId
        ? {
            ...p,
            model: "second-model",
            thinkingOptionId: "deep",
            featureValues: { style: "concise" },
            notes: "Edited rules are authoritative.",
          }
        : p,
    );
    await daemon.client.config.patch({ agentProfiles: edited });
    await writeFile(
      join(daemon.pluginPath, "server", "management.ts"),
      'export const managementPrompt = "An upgraded seed must not replace user content.";\n',
    );
    await cli(daemon, ["plugin", "reload", "paseo-bot"]);
    for (const id of [
      (await native(daemon, workspaceId)).id,
      (await legacy(daemon)).id,
    ]) {
      const actual = await inspect(daemon, id);
      assert.equal(actual.systemPrompt, "Edited rules are authoritative.");
      assert.equal(actual.model, "second-model");
      assert.equal(actual.thinkingOption, "deep");
      assert.deepEqual(actual.settings, { style: "concise" });
    }
    const cleared = edited.map((p) =>
      p.id === profileId ? { ...p, notes: "" } : p,
    );
    await daemon.client.config.patch({ agentProfiles: cleared });
    await cli(daemon, ["plugin", "disable", "paseo-bot"]);
    await cli(daemon, ["plugin", "enable", "paseo-bot"]);
    await daemon.restart();
    await daemon.rpc("prepare-coordinator", {});
    assert.deepEqual(
      (await daemon.client.config.get()).config.agentProfiles,
      cleared,
    );
    for (const id of [
      (await native(daemon, workspaceId)).id,
      (await legacy(daemon)).id,
    ]) {
      assert.equal((await inspect(daemon, id)).systemPrompt ?? "", "");
    }
    await daemon.client.agents
      .ref(prior.id)
      .run("inspect-bot-config", { timeoutMs: 10000 });
    assert.equal(
      (await inspect(daemon, prior.id)).systemPrompt,
      original.systemPrompt,
    );
    const history = await daemon.rpc("list-conversations", {});
    assert.equal(history.entries.length, 5);
    assert.ok(history.entries.some((e) => e.id === prior.id));
    await cli(daemon, ["plugin", "remove", "paseo-bot"]);
    assert.deepEqual(
      (await daemon.client.config.get()).config.agentProfiles,
      cleared,
    );
    assert.ok(
      (await daemon.client.agents.ref(prior.id).timeline.refetch()).entries
        .length,
    );
    await cli(daemon, ["plugin", "install", daemon.pluginPath]);
    const restored = z
      .object({ profile: z.object({ id: z.string() }) })
      .parse(await daemon.rpc("prepare-coordinator", {}));
    assert.equal(restored.profile.id, profileId);
    assert.deepEqual(
      (await daemon.client.config.get()).config.agentProfiles,
      cleared,
    );
    assert.equal(
      (await daemon.rpc("list-conversations", {})).entries.length,
      5,
    );
  } finally {
    await daemon.close();
  }
});

test("missing plugin state is an unknown association, not first-time preset setup", {
  timeout: 60000,
}, async () => {
  const daemon = await createIsolatedDaemon({ fixture: true });
  try {
    const { profileId } = await setup(daemon);
    const path = join(daemon.home, "plugin-data", "paseo-bot", "state.json");
    const saved = await readFile(path);
    await rm(path);
    await assert.rejects(
      daemon.rpc("prepare-coordinator", { sourceProfileId: "source" }),
      /state.*(missing|unknown)|association.*unknown/i,
    );
    await assert.rejects(
      daemon.rpc("open-workspace", {}),
      /state.*(missing|unknown)|association.*unknown/i,
    );
    const profiles =
      (await daemon.client.config.get()).config.agentProfiles ?? [];
    assert.equal(profiles.length, 2);
    assert.ok(profiles.some((p) => p.id === profileId));
    await writeFile(path, saved, { mode: 0o600 });
    const ready = z
      .object({ profile: z.object({ id: z.string() }) })
      .parse(await daemon.rpc("prepare-coordinator", {}));
    assert.equal(ready.profile.id, profileId);
    await writeFile(path, "config-secret-canary invalid state");
    await assert.rejects(
      daemon.rpc("prepare-coordinator", {}),
      (error: Error) => {
        assert.match(
          error.message,
          /state.*(read|unknown)|association.*unknown/i,
        );
        assert.doesNotMatch(error.message, /config-secret-canary/);
        return true;
      },
    );
    const unbound = JSON.parse(saved.toString());
    delete unbound.coordinator;
    await writeFile(path, JSON.stringify(unbound));
    await assert.rejects(
      daemon.rpc("prepare-coordinator", {}),
      /association.*unknown/i,
    );
    await writeFile(path, saved);
  } finally {
    await daemon.close();
  }
});

test("clearing all plugin metadata cannot adopt or duplicate a surviving preset or workspace after reload", {
  timeout: 60000,
}, async () => {
  const daemon = await createIsolatedDaemon({ fixture: true });
  try {
    const { profileId, workspaceId } = await setup(daemon);
    const prior = await native(daemon, workspaceId);
    await inspect(daemon, prior.id);
    await cli(daemon, ["plugin", "disable", "paseo-bot"]);
    await rm(join(daemon.home, "plugin-data", "paseo-bot"), {
      recursive: true,
    });
    await cli(daemon, ["plugin", "enable", "paseo-bot"]);
    await assert.rejects(
      daemon.rpc("prepare-coordinator", { sourceProfileId: "source" }),
      /association.*unknown/i,
    );
    await assert.rejects(
      daemon.rpc("open-workspace", {}),
      /association.*unknown/i,
    );
    await assert.rejects(native(daemon, workspaceId), /association.*unknown/i);
    await assert.rejects(legacy(daemon), /association.*unknown/i);
    const profiles =
      (await daemon.client.config.get()).config.agentProfiles ?? [];
    assert.equal(profiles.length, 2);
    assert.ok(profiles.some((p) => p.id === profileId));
    assert.ok(
      (await daemon.client.agents.ref(prior.id).timeline.refetch()).entries
        .length,
    );
    assert.equal(
      (await daemon.client.agents.list({ filter: { includeBackground: true } }))
        .entries.length,
      1,
    );
  } finally {
    await daemon.close();
  }
});

test("confirmed deletion keeps both creation paths open using explicit runtime inputs and one public default rule set", {
  timeout: 60000,
}, async () => {
  const daemon = await createIsolatedDaemon({ fixture: true });
  try {
    const { profileId, workspaceId } = await setup(daemon);
    const profiles =
      (await daemon.client.config.get()).config.agentProfiles ?? [];
    await daemon.client.config.patch({
      agentProfiles: profiles.map((p) =>
        p.id === profileId
          ? { ...p, notes: "Deleted custom instructions must stay deleted." }
          : p,
      ),
    });
    const prior = await native(daemon, workspaceId);
    await inspect(daemon, prior.id);
    const remaining = profiles
      .filter((p) => p.id !== profileId)
      .map((p) => ({ ...p, name: "Paseo Team Coordinator" }));
    await daemon.client.config.patch({ agentProfiles: remaining });
    await cli(daemon, ["plugin", "reload", "paseo-bot"]);
    assert.deepEqual(await daemon.rpc("prepare-coordinator", {}), {
      status: "ready",
      profile: null,
    });
    assert.deepEqual(await daemon.rpc("open-workspace", {}), { workspaceId });
    const config = {
      provider: "bot-other",
      model: "second-model",
      modeId: "bypass",
      thinkingOptionId: "deep",
      featureValues: { style: "explicit fallback" },
    };
    const next = await daemon.client.workspaces.ref(workspaceId).agents.create({
      config: {
        ...config,
        provider: "bot-other/second-model",
        systemPrompt: "Keep native instructions.",
      },
      prompt: "inspect-bot-config",
    });
    const oldRpc = await daemon.rpc("create-conversation", {
      requestId: randomUUID(),
      text: "inspect-bot-config",
      config,
    });
    for (const id of [next.id, oldRpc.id]) {
      const actual = await inspect(daemon, id);
      assert.equal(actual.model, "second-model");
      assert.equal(actual.mode, "bypass");
      assert.equal(actual.thinkingOption, "deep");
      assert.equal(actual.settings.style, "explicit fallback");
      assert.equal(actual.systemPrompt.split("你是 Paseo Bot").length - 1, 1);
      assert.doesNotMatch(actual.systemPrompt, /Deleted custom instructions/);
      if (id === next.id)
        assert.match(actual.systemPrompt, /Keep native instructions/);
      assert.equal(
        (await daemon.client.agents.ref(id).refresh())?.agent.provider,
        "bot-other",
      );
    }
    assert.deepEqual(oldRpc.config, config);
    await daemon.client.agents
      .ref(prior.id)
      .run("inspect-bot-config", { timeoutMs: 10000 });
    assert.equal(
      (await inspect(daemon, prior.id)).systemPrompt,
      "Deleted custom instructions must stay deleted.",
    );
    assert.deepEqual(
      (await daemon.client.config.get()).config.agentProfiles,
      remaining,
    );
    assert.equal(
      (await daemon.rpc("list-conversations", {})).entries.length,
      3,
    );
  } finally {
    await daemon.close();
  }
});

test("native fallback retains host default-model and alias semantics", {
  timeout: 60000,
}, async () => {
  const daemon = await createIsolatedDaemon({ fixture: true });
  try {
    const { profileId, workspaceId } = await setup(daemon);
    const profiles =
      (await daemon.client.config.get()).config.agentProfiles ?? [];
    await daemon.client.config.patch({
      agentProfiles: profiles.filter((profile) => profile.id !== profileId),
    });
    const { directory } = await daemon.rpc("bootstrap", {});
    for (const model of [undefined, "test-alias"]) {
      const agent = await daemon.driver.createAgent({
        workspaceId,
        config: {
          provider: "bot-test",
          cwd: directory,
          modeId: "approve",
          thinkingOptionId: "brief",
          ...(model ? { model } : {}),
        },
        initialPrompt: "inspect-bot-config",
      });
      const actual = await inspect(daemon, agent.id);
      assert.equal(actual.thinkingOption, "brief");
      assert.equal(actual.systemPrompt.split("你是 Paseo Bot").length - 1, 1);
    }
  } finally {
    await daemon.close();
  }
});

test("configuration read denial and unavailability fail both creation paths rather than activating deletion fallback", {
  timeout: 60000,
}, async () => {
  const daemon = await createIsolatedDaemon({
    fixture: true,
    configFaults: true,
  });
  try {
    const { profileId, workspaceId } = await setup(daemon);
    for (const read of ["unavailable", "denied"]) {
      await writeFile(
        join(daemon.home, "config-fault.json"),
        JSON.stringify({ read }),
      );
      for (const operation of [
        () => daemon.rpc("prepare-coordinator", {}),
        () => native(daemon, workspaceId),
        () => legacy(daemon),
      ])
        await assert.rejects(operation, (error: Error) => {
          assert.match(
            error.message,
            read === "denied"
              ? /Permission denied.*presets/i
              : /could not read.*presets/i,
          );
          assert.doesNotMatch(error.message, /config-secret-canary/);
          return true;
        });
    }
    assert.equal(
      (await daemon.client.agents.list({ filter: { includeBackground: true } }))
        .entries.length,
      0,
    );
    await writeFile(join(daemon.home, "config-fault.json"), "{}");
    const profiles =
      (await daemon.client.config.get()).config.agentProfiles ?? [];
    await daemon.client.config.patch({
      agentProfiles: profiles.map((p) =>
        p.id === profileId ? { ...p, model: undefined } : p,
      ),
    });
    await assert.rejects(legacy(daemon), /explicit model.*Coordinator preset/i);
    assert.deepEqual(await daemon.rpc("prepare-coordinator", {}), {
      status: "ready",
      profile: { id: profileId, name: "Paseo Team Coordinator" },
    });
    await daemon.client.config.patch({
      agentProfiles: profiles.map((p) =>
        p.id === profileId ? { ...p, model: "removed-model" } : p,
      ),
    });
    await assert.rejects(native(daemon, workspaceId), /model/i);
    await assert.rejects(legacy(daemon), /model/i);
    assert.equal(
      (await daemon.client.agents.list({ filter: { includeBackground: true } }))
        .entries.length,
      0,
    );
  } finally {
    await daemon.close();
  }
});

test("an unconfirmed initialization is checked by its stable identity and never rewritten on retry", {
  timeout: 60000,
}, async () => {
  const daemon = await createIsolatedDaemon({
    fixture: true,
    configFaults: true,
  });
  try {
    await daemon.client.config.patch({
      agentProfiles: [{ id: "source", name: "Source", ...explicit }],
    });
    await writeFile(
      join(daemon.home, "config-fault.json"),
      JSON.stringify({ write: "not-sent" }),
    );
    await assert.rejects(
      daemon.rpc("prepare-coordinator", { sourceProfileId: "source" }),
      /not confirmed|unknown/i,
    );
    await writeFile(join(daemon.home, "config-fault.json"), "{}");
    await assert.rejects(
      daemon.rpc("prepare-coordinator", {}),
      /outcome.*unknown/i,
    );
    await assert.rejects(
      daemon.rpc("prepare-coordinator", { sourceProfileId: "source" }),
      /outcome.*unknown/i,
    );
    assert.equal(
      (await readFile(join(daemon.home, "config-patch-attempts.txt"), "utf8"))
        .trim()
        .split("\n").length,
      1,
    );
    assert.equal(
      (await daemon.client.config.get()).config.agentProfiles?.length,
      1,
    );
    await assert.rejects(legacy(daemon), /setup is incomplete/i);
    await assert.rejects(
      daemon.rpc("open-workspace", {}),
      /creation outcome is unknown/i,
    );
    assert.equal((await daemon.rpc("bootstrap", {})).workspaceId, null);
  } finally {
    await daemon.close();
  }
});

test("lost acknowledgements and failed confirmation recover the same preset without overwriting later edits", {
  timeout: 60000,
}, async (t) => {
  for (const write of ["lost-ack", "commit-unreadable"])
    await t.test(write, async () => {
      const daemon = await createIsolatedDaemon({
        fixture: true,
        configFaults: true,
      });
      try {
        await daemon.client.config.patch({
          agentProfiles: [{ id: "source", name: "Source", ...explicit }],
        });
        await writeFile(
          join(daemon.home, "config-fault.json"),
          JSON.stringify({ write }),
        );
        if (write === "lost-ack") {
          const ready = z
            .object({
              status: z.literal("ready"),
              profile: z.object({ id: z.string() }),
            })
            .parse(
              await daemon.rpc("prepare-coordinator", {
                sourceProfileId: "source",
              }),
            );
          assert.ok(ready.profile.id);
        } else
          await assert.rejects(
            daemon.rpc("prepare-coordinator", { sourceProfileId: "source" }),
            /could not read.*unknown/i,
          );
        const profiles =
          (await daemon.client.config.get()).config.agentProfiles ?? [];
        const created = profiles.find((p) => p.id !== "source");
        assert.ok(created);
        const edited = profiles.map((p) =>
          p.id === created.id
            ? { ...p, notes: "An edit after the unacknowledged write." }
            : p,
        );
        await daemon.client.config.patch({ agentProfiles: edited });
        await writeFile(join(daemon.home, "config-fault.json"), "{}");
        await cli(daemon, ["plugin", "reload", "paseo-bot"]);
        const { workspaceId } = z
          .object({ workspaceId: z.string() })
          .parse(await daemon.rpc("open-workspace", {}));
        const resumed = await native(daemon, workspaceId);
        assert.equal(
          (await inspect(daemon, resumed.id)).systemPrompt,
          "An edit after the unacknowledged write.",
        );
        const result = z
          .object({ profile: z.object({ id: z.string() }) })
          .parse(await daemon.rpc("prepare-coordinator", {}));
        assert.equal(result.profile.id, created.id);
        assert.deepEqual(
          (await daemon.client.config.get()).config.agentProfiles,
          edited,
        );
        assert.equal(
          (
            await readFile(
              join(daemon.home, "config-patch-attempts.txt"),
              "utf8",
            )
          )
            .trim()
            .split("\n").length,
          1,
        );
      } finally {
        await daemon.close();
      }
    });
});

test("a definite configuration write denial permits an explicit retry after access is restored", {
  timeout: 60000,
}, async () => {
  const daemon = await createIsolatedDaemon({
    fixture: true,
    configFaults: true,
  });
  try {
    await daemon.client.config.patch({
      agentProfiles: [{ id: "source", name: "Source", ...explicit }],
    });
    await writeFile(
      join(daemon.home, "config-fault.json"),
      JSON.stringify({ write: "denied" }),
    );
    await assert.rejects(
      daemon.rpc("prepare-coordinator", { sourceProfileId: "source" }),
      (error: Error) => {
        assert.match(error.message, /Permission denied updating.*presets/i);
        assert.doesNotMatch(error.message, /config-secret-canary/);
        return true;
      },
    );
    assert.equal(
      (await daemon.client.config.get()).config.agentProfiles?.length,
      1,
    );
    await writeFile(join(daemon.home, "config-fault.json"), "{}");
    const ready = z
      .object({
        status: z.literal("ready"),
        profile: z.object({ id: z.string() }),
      })
      .parse(
        await daemon.rpc("prepare-coordinator", { sourceProfileId: "source" }),
      );
    assert.ok(ready.profile.id);
    assert.equal(
      (await daemon.client.config.get()).config.agentProfiles?.length,
      2,
    );
  } finally {
    await daemon.close();
  }
});
