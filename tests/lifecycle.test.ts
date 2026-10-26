import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createIsolatedDaemon } from "./isolated-daemon.ts";

test("archive confirms Stop before mutation and failed Stop retains an active owned conversation", {
  timeout: 60000,
}, async () => {
  const daemon = await createIsolatedDaemon({ fixture: true });
  try {
    async function start(text: string) {
      return daemon.rpc("create-conversation", {
        requestId: randomUUID(),
        text,
        config: {
          provider: "bot-test",
          model: "test-model",
          modeId: "approve",
          thinkingOptionId: "brief",
        },
      });
    }
    const active = await start("hold archive me");
    const refused = await start("stop-failure archive");
    const result = (await daemon.rpc("archive-conversation", {
      id: active.id,
    })) as { id: string; archivedAt: string };
    assert.equal(result.id, active.id);
    assert.ok(result.archivedAt);
    const archived = (await daemon.client.agents.ref(active.id).refresh())
      ?.agent;
    assert.ok(archived?.archivedAt);
    assert.equal(archived.activeTurn ?? null, null);
    await assert.rejects(
      daemon.rpc("archive-conversation", { id: refused.id }),
      /Stop was not confirmed/,
    );
    const retained = (await daemon.client.agents.ref(refused.id).refresh())
      ?.agent;
    assert.equal(retained?.archivedAt ?? null, null);
    assert.equal(retained?.status, "running");
    await assert.rejects(
      daemon.rpc("rename-conversation", {
        id: active.id,
        title: "Cannot rename",
      }),
      /read-only/,
    );
    const history = await daemon.rpc("list-conversations", {});
    assert.deepEqual(
      history.entries.map((entry) => entry.id),
      [refused.id],
    );
    const old = await daemon.rpc("list-conversations", { archived: true });
    assert.deepEqual(
      old.entries.map((entry) => entry.id),
      [active.id],
    );
    const timeline = await daemon.client.agents
      .ref(active.id)
      .timeline.refetch();
    assert.ok(
      timeline.entries.some(
        ({ item }) =>
          item.type === "user_message" && item.text === "hold archive me",
      ),
      JSON.stringify(timeline),
    );
  } finally {
    await daemon.close();
  }
});

test("external workspace archive waits for explicit concurrent-safe rebuild and preserves old read-only generations and files", {
  timeout: 60000,
}, async () => {
  const daemon = await createIsolatedDaemon({ fixture: true });
  try {
    const config = {
      provider: "bot-test",
      model: "test-model",
      modeId: "approve",
      thinkingOptionId: "brief",
    };
    const first = await daemon.rpc("create-conversation", {
      requestId: randomUUID(),
      text: "old generation",
      config,
    });
    await daemon.client.agents.ref(first.id).waitForFinish(10000);
    const oldWorkspace = daemon.client.workspaces.ref(first.workspaceId);
    const initial = await daemon.rpc("bootstrap", {});
    const { writeFile, readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const file = join(initial.directory, "keep.txt");
    await writeFile(file, "Shared files survive archive and rebuild");
    const result = await oldWorkspace.archive();
    assert.equal(result.error, null);
    let inspected = (await daemon.rpc("inspect-workspace", {})) as {
      workspaceId: string;
      state: string;
    };
    for (
      let attempt = 0;
      attempt < 50 && inspected.state === "ready";
      attempt++
    ) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      inspected = (await daemon.rpc(
        "inspect-workspace",
        {},
      )) as typeof inspected;
    }
    assert.equal(inspected.state, "archived");
    assert.equal(inspected.workspaceId, first.workspaceId);
    assert.equal(
      (await daemon.rpc("bootstrap", {})).workspaceId,
      first.workspaceId,
    );
    await assert.rejects(
      daemon.rpc("create-conversation", {
        requestId: randomUUID(),
        text: "No auto replacement",
        config,
      }),
      /archived|unavailable/,
    );
    assert.equal(
      (
        await daemon.client.workspaces.list({
          filter: { includeBackground: true },
        })
      ).entries.length,
      0,
    );
    const [one, two] = (await Promise.all([
      daemon.rpc("rebuild-workspace", {
        expectedWorkspaceId: first.workspaceId,
      }),
      daemon.rpc("rebuild-workspace", {
        expectedWorkspaceId: first.workspaceId,
      }),
    ])) as { workspaceId: string }[];
    assert.equal(one.workspaceId, two.workspaceId);
    assert.notEqual(one.workspaceId, first.workspaceId);
    assert.equal(await oldWorkspace.refresh(), null);
    const active = await daemon.client.workspaces.list({
      filter: { includeBackground: true },
    });
    assert.equal(active.entries.length, 1);
    assert.equal(active.entries[0].background, true);
    assert.equal(
      await readFile(file, "utf8"),
      "Shared files survive archive and rebuild",
    );
    const old = await daemon.rpc("list-conversations", {
      archived: true,
      limit: 1,
    });
    assert.equal(old.entries[0].id, first.id);
    assert.equal(old.entries[0].workspaceId, first.workspaceId);
    const timeline = await daemon.client.agents
      .ref(first.id)
      .timeline.refetch();
    assert.ok(
      timeline.entries.some(
        ({ item }) =>
          item.type === "user_message" && item.text === "old generation",
      ),
    );
    await assert.rejects(
      daemon.rpc("rename-conversation", { id: first.id, title: "Read only" }),
      /read-only/,
    );
    const next = await daemon.rpc("create-conversation", {
      requestId: randomUUID(),
      text: "new generation",
      config,
    });
    assert.equal(next.workspaceId, one.workspaceId);
  } finally {
    await daemon.close();
  }
});

test("archive performed while the Bot plugin is disabled is identified durably after reload through the public ESM recovery probe", {
  timeout: 60000,
}, async () => {
  const daemon = await createIsolatedDaemon({ fixture: true });
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  async function cli(action: string) {
    await promisify(execFile)(
      "paseo",
      ["plugin", action, "paseo-bot", "--home", daemon.home, "--json"],
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
    const first = await daemon.rpc("create-conversation", {
      requestId: randomUUID(),
      text: "durable archive",
      config: {
        provider: "bot-test",
        model: "test-model",
        modeId: "approve",
        thinkingOptionId: "brief",
      },
    });
    await daemon.client.agents.ref(first.id).waitForFinish(10000);
    await cli("disable");
    assert.equal(
      (await daemon.client.workspaces.ref(first.workspaceId).archive()).error,
      null,
    );
    await cli("enable");
    const status = (await daemon.rpc("inspect-workspace", {})) as {
      workspaceId: string;
      state: string;
    };
    assert.equal(status.state, "archived");
    assert.equal(status.workspaceId, first.workspaceId);
    const { resolve } = await import("node:path");
    const missing = await promisify(execFile)(
      process.execPath,
      [
        resolve("server/recovery-probe.mjs"),
        daemon.home,
        "wks_0000000000000000",
      ],
      { timeout: 15000 },
    );
    assert.deepEqual(JSON.parse(missing.stdout), { state: "unavailable" });
    const archived = await daemon.rpc("list-conversations", { archived: true });
    assert.equal(archived.entries[0].id, first.id);
  } finally {
    await daemon.close();
  }
});
