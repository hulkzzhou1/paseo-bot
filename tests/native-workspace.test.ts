import { strict as assert } from "node:assert";
import { z } from "zod";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createIsolatedDaemon } from "./isolated-daemon.ts";
import { createHostClient } from "@getpaseo/client/node";

test("first entry copies an explicitly chosen source into one dedicated Coordinator preset without creating an Agent", {
  timeout: 60000,
}, async () => {
  const daemon = await createIsolatedDaemon({ fixture: true });
  try {
    const source = {
      id: "source",
      name: "Source profile",
      provider: "bot-test",
      model: "test-model",
      modeId: "approve",
      thinkingOptionId: "brief",
      featureValues: { style: "concise" },
      notes: "Source usage notes, not Coordinator rules.",
      privateExtension: "Do not copy unknown fields.",
    };
    await daemon.client.config.patch({ agentProfiles: [source] });
    assert.deepEqual(await daemon.rpc("prepare-coordinator", {}), {
      status: "choose-source",
      sources: [
        {
          id: "source",
          name: "Source profile",
          provider: "bot-test",
          model: "test-model",
          modeId: "approve",
        },
      ],
    });
    await assert.rejects(
      daemon.rpc("prepare-coordinator", { sourceProfileId: "missing" }),
      /source.*preset/i,
    );
    await daemon.client.config.patch({
      agentProfiles: [{ ...source, model: undefined }],
    });
    await assert.rejects(
      daemon.rpc("prepare-coordinator", { sourceProfileId: "source" }),
      /explicit provider and model/,
    );
    assert.equal(
      (await daemon.client.config.get()).config.agentProfiles?.length,
      1,
    );
    await daemon.client.config.patch({ agentProfiles: [source] });
    const [first, second] = await Promise.all([
      daemon.rpc("prepare-coordinator", { sourceProfileId: "source" }),
      daemon.rpc("prepare-coordinator", { sourceProfileId: "source" }),
    ]);
    assert.deepEqual(first, second);
    const ready = z
      .object({
        status: z.literal("ready"),
        profile: z.object({ id: z.string(), name: z.string() }),
      })
      .parse(first);
    assert.notEqual(ready.profile.id, source.id);
    const profiles =
      (await daemon.client.config.get()).config.agentProfiles ?? [];
    assert.equal(profiles.length, 2);
    assert.deepEqual(profiles[0], source);
    const dedicated = profiles[1];
    assert.equal(dedicated.id, ready.profile.id);
    assert.equal(dedicated.provider, "bot-test");
    assert.equal(dedicated.model, "test-model");
    assert.equal(dedicated.modeId, "approve");
    assert.equal(dedicated.thinkingOptionId, "brief");
    assert.deepEqual(dedicated.featureValues, { style: "concise" });
    assert.equal(dedicated.privateExtension, undefined);
    assert.match(dedicated.notes ?? "", /Coordinator|Paseo Bot/);
    assert.notEqual(dedicated.notes, source.notes);
    assert.deepEqual(await daemon.rpc("prepare-coordinator", {}), ready);
    await daemon.client.config.patch({
      agentProfiles: profiles.map((profile) =>
        profile.id === source.id
          ? { ...profile, model: "second-model" }
          : profile,
      ),
    });
    await daemon.rpc("prepare-coordinator", { sourceProfileId: source.id });
    const independent = (
      await daemon.client.config.get()
    ).config.agentProfiles?.find((profile) => profile.id === dedicated.id);
    assert.equal(independent?.model, "test-model");
    assert.equal((await daemon.client.agents.list()).entries.length, 0);
    assert.equal((await daemon.rpc("bootstrap", {})).workspaceId, null);
  } finally {
    await daemon.close();
  }
});

test("a Coordinator provider or permission conflict fails before creating or sending an Agent", {
  timeout: 60000,
}, async () => {
  const daemon = await createIsolatedDaemon({ fixture: true });
  try {
    await daemon.client.config.patch({
      agentProfiles: [
        {
          id: "source",
          name: "Source",
          provider: "bot-test",
          model: "test-model",
          modeId: "approve",
          thinkingOptionId: "brief",
        },
      ],
    });
    await daemon.rpc("prepare-coordinator", { sourceProfileId: "source" });
    const { workspaceId } = z
      .object({ workspaceId: z.string() })
      .parse(await daemon.rpc("open-workspace", {}));
    for (const config of [
      { provider: "bot-test/test-model", modeId: "bypass" },
      { provider: "bot-other/test-model", modeId: "approve" },
    ])
      await assert.rejects(
        daemon.client.workspaces.ref(workspaceId).agents.create({
          config,
          prompt: "This must not be sent.",
        }),
        /Coordinator preset|permission mode/,
      );
    await assert.rejects(
      daemon.rpc("create-conversation", {
        requestId: randomUUID(),
        text: "This must not be sent.",
        config: { provider: "bot-test", model: "test-model", modeId: "bypass" },
      }),
      /Coordinator preset|permission mode/,
    );
    assert.equal((await daemon.client.agents.list()).entries.length, 0);
    assert.equal((await daemon.rpc("bootstrap", {})).conversations.length, 0);
  } finally {
    await daemon.close();
  }
});

test("opening native Bot workspace is concurrent-safe and creates no Agent", {
  timeout: 60000,
}, async () => {
  const daemon = await createIsolatedDaemon({ fixture: true });
  try {
    const [first, second] = await Promise.all([
      daemon
        .rpc("open-workspace", {})
        .then((value) => z.object({ workspaceId: z.string() }).parse(value)),
      daemon
        .rpc("open-workspace", {})
        .then((value) => z.object({ workspaceId: z.string() }).parse(value)),
    ]);
    assert.equal(first.workspaceId, second.workspaceId);
    const workspace = await daemon.client.workspaces
      .ref(first.workspaceId)
      .refresh();
    assert.equal(workspace?.background, true);
    const agents = await daemon.client.agents.list();
    assert.equal(agents.entries.length, 0);
  } finally {
    await daemon.close();
  }
});

test("native root conversations join Bot history without adopting delegated or other-workspace Agents", {
  timeout: 60000,
}, async () => {
  const daemon = await createIsolatedDaemon({ fixture: true });
  try {
    const { workspaceId } = z
      .object({ workspaceId: z.string() })
      .parse(await daemon.rpc("open-workspace", {}));
    const native = await daemon.client.workspaces
      .ref(workspaceId)
      .agents.create({
        config: { provider: "bot-test/test-model", modeId: "approve" },
        title: "Native conversation",
      });
    const child = await daemon.client.workspaces
      .ref(workspaceId)
      .agents.create({
        config: { provider: "bot-test/test-model", modeId: "approve" },
        parent: native.id,
        title: "Delegated child",
      });
    const outsidePath = join(daemon.home, "business");
    await mkdir(outsidePath);
    const outsideWorkspace = await daemon.client.workspaces.create({
      source: { kind: "directory", path: outsidePath },
    });
    const outside = await outsideWorkspace.agents.create({
      config: { provider: "bot-test/test-model", modeId: "approve" },
      title: "Native conversation",
    });
    await assert.rejects(
      daemon.rpc("rename-conversation", { id: outside.id, title: "No" }),
      /owned|Bot conversation/,
    );
    const history = await daemon.rpc("list-conversations", {});
    assert.deepEqual(
      history.entries.map((entry) => entry.id),
      [native.id],
    );
    await assert.rejects(
      daemon.rpc("rename-conversation", { id: child.id, title: "No" }),
      /owned|Bot conversation/,
    );
    await daemon.rpc("rename-conversation", {
      id: native.id,
      title: "Renamed native",
    });
    assert.equal((await native.refresh())?.agent.title, "Renamed native");
    await daemon.rpc("archive-conversation", { id: native.id });
    const archived = await daemon.rpc("list-conversations", { archived: true });
    assert.deepEqual(
      archived.entries.map((entry) => entry.id),
      [native.id],
    );
  } finally {
    await daemon.close();
  }
});

test("native and legacy creation use the dedicated preset settings and exactly one copy of its notes", {
  timeout: 60000,
}, async () => {
  const daemon = await createIsolatedDaemon({ fixture: true });
  try {
    await daemon.client.config.patch({
      agentProfiles: [
        {
          id: "source",
          name: "Source",
          provider: "bot-test",
          model: "second-model",
          modeId: "approve",
          thinkingOptionId: "deep",
          featureValues: { style: "concise" },
        },
      ],
    });
    const { profile } = z
      .object({ profile: z.object({ id: z.string() }) })
      .parse(
        await daemon.rpc("prepare-coordinator", { sourceProfileId: "source" }),
      );
    const profiles =
      (await daemon.client.config.get()).config.agentProfiles ?? [];
    await daemon.client.config.patch({
      agentProfiles: profiles.map((p) =>
        p.id === profile.id
          ? { ...p, notes: "Use verified project evidence. Coordinator rules." }
          : p,
      ),
    });
    const { workspaceId } = z
      .object({ workspaceId: z.string() })
      .parse(await daemon.rpc("open-workspace", {}));
    const native = await daemon.client.workspaces
      .ref(workspaceId)
      .agents.create({
        config: {
          provider: "bot-test/test-model",
          modeId: "approve",
          thinkingOptionId: "brief",
          featureValues: { style: "verbose", preserve: true },
          systemPrompt:
            "Keep the user's profile instructions.\n\nUse verified project evidence. Coordinator rules.",
        },
        prompt: "inspect-bot-config",
      });
    const legacy = await daemon.rpc("create-conversation", {
      requestId: randomUUID(),
      text: "inspect-bot-config",
      config: {
        provider: "bot-test",
        model: "test-model",
        modeId: "approve",
        thinkingOptionId: "brief",
      },
    });
    for (const id of [native.id, legacy.id]) {
      const agent = daemon.client.agents.ref(id);
      await agent.waitForFinish(10000);
      const page = await agent.timeline.refetch();
      const message = page.entries.find(
        ({ item }) => item.type === "assistant_message",
      );
      assert.ok(message?.item.type === "assistant_message");
      const actual = JSON.parse(message.item.text);
      assert.equal(
        actual.systemPrompt.split("Coordinator rules.").length - 1,
        1,
      );
      assert.doesNotMatch(
        actual.systemPrompt,
        /You are Paseo Bot|你是 Paseo Bot/,
      );
      if (id === native.id)
        assert.match(
          actual.systemPrompt,
          /Keep the user's profile instructions/,
        );
      assert.equal(actual.model, "second-model");
      assert.equal(actual.thinkingOption, "deep");
      assert.equal(actual.settings.style, "concise");
      if (id === native.id) assert.equal(actual.settings.preserve, true);
      assert.equal(actual.mode, "approve");
      assert.equal(actual.preapproved, 0);
      assert.deepEqual(actual.mcpServers, []);
      const saved = (await agent.refresh())?.agent;
      assert.equal(saved?.model, "second-model");
    }
    assert.equal(legacy.config.model, "second-model");
  } finally {
    await daemon.close();
  }
});

test("native entry reuses legacy history and archived generations require explicit rebuild", {
  timeout: 60000,
}, async () => {
  const daemon = await createIsolatedDaemon({ fixture: true });
  try {
    const legacy = await daemon.rpc("create-conversation", {
      requestId: randomUUID(),
      text: "Legacy history",
      config: {
        provider: "bot-test",
        model: "test-model",
        modeId: "approve",
        thinkingOptionId: "brief",
      },
    });
    await daemon.client.agents.ref(legacy.id).waitForFinish(10000);
    const opened = z
      .object({ workspaceId: z.string() })
      .parse(await daemon.rpc("open-workspace", {}));
    assert.equal(opened.workspaceId, legacy.workspaceId);
    const native = await daemon.client.workspaces
      .ref(opened.workspaceId)
      .agents.create({
        config: { provider: "bot-test/test-model", modeId: "approve" },
        title: "Native before rebuild",
      });
    await daemon.client.workspaces.ref(opened.workspaceId).archive();
    await assert.rejects(
      daemon.rpc("open-workspace", {}),
      /archived|unavailable/,
    );
    const rebuilt = z.object({ workspaceId: z.string() }).parse(
      await daemon.rpc("rebuild-workspace", {
        expectedWorkspaceId: opened.workspaceId,
      }),
    );
    assert.notEqual(rebuilt.workspaceId, opened.workspaceId);
    assert.deepEqual(await daemon.rpc("open-workspace", {}), rebuilt);
    const archived = await daemon.rpc("list-conversations", { archived: true });
    assert.ok(archived.entries.some((entry) => entry.id === legacy.id));
    assert.ok(archived.entries.some((entry) => entry.id === native.id));
  } finally {
    await daemon.close();
  }
});

test("reloading an existing Bot conversation preserves its saved role and history", {
  timeout: 60000,
}, async () => {
  const daemon = await createIsolatedDaemon({ fixture: true });
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  async function cli(args: string[]) {
    await promisify(execFile)(
      "paseo",
      [...args, "--home", daemon.home, "--json"],
      {
        env: Object.fromEntries(
          Object.entries(process.env).filter(
            ([key]) => key !== "PASEO_PASSWORD" && key !== "PASEO_HOST",
          ),
        ),
        timeout: 15000,
      },
    );
  }
  try {
    const { workspaceId } = z
      .object({ workspaceId: z.string() })
      .parse(await daemon.rpc("open-workspace", {}));
    await cli(["plugin", "disable", "paseo-bot"]);
    const existing = await daemon.client.workspaces
      .ref(workspaceId)
      .agents.create({
        config: {
          provider: "bot-test/test-model",
          modeId: "approve",
          systemPrompt: "Historical Bot instructions.",
        },
      });
    await cli(["plugin", "enable", "paseo-bot"]);
    const driver = createHostClient(`ws://127.0.0.1:${daemon.port}/ws`, {
      clientId: randomUUID(),
      password: daemon.password,
      appVersion: "0.13.2",
      reconnect: { enabled: false },
    });
    try {
      await driver.connect();
      await driver.refreshAgent(existing.id);
    } finally {
      await driver.close();
    }
    await existing.run("inspect-bot-config", { timeoutMs: 10000 });
    const page = await existing.timeline.refetch();
    const message = page.entries.find(
      (entry) => entry.item.type === "assistant_message",
    );
    assert.ok(message?.item.type === "assistant_message");
    assert.equal(
      JSON.parse(message.item.text).systemPrompt,
      "Historical Bot instructions.",
    );
    const history = await daemon.rpc("list-conversations", {});
    assert.deepEqual(
      history.entries.map((entry) => entry.id),
      [existing.id],
    );
  } finally {
    await daemon.close();
  }
});
