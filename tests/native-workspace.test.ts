import { strict as assert } from "node:assert";
import { z } from "zod";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createIsolatedDaemon } from "./isolated-daemon.ts";
import { createHostClient } from "@getpaseo/client/node";

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

test("native creation retains system choices and receives Bot guidance without enabling tools", {
  timeout: 60000,
}, async () => {
  const daemon = await createIsolatedDaemon({ fixture: true });
  try {
    const { workspaceId } = z
      .object({ workspaceId: z.string() })
      .parse(await daemon.rpc("open-workspace", {}));
    const agent = await daemon.client.workspaces
      .ref(workspaceId)
      .agents.create({
        config: {
          provider: "bot-test/test-model",
          modeId: "approve",
          thinkingOptionId: "brief",
          systemPrompt: "Keep the user's profile instructions.",
        },
        prompt: "inspect-bot-config",
      });
    await agent.waitForFinish(10000);
    const page = await agent.timeline.refetch();
    const message = page.entries.find(
      (entry) => entry.item.type === "assistant_message",
    );
    assert.ok(message?.item.type === "assistant_message");
    const actual = JSON.parse(message.item.text);
    assert.match(actual.systemPrompt, /Paseo Bot/);
    assert.match(actual.systemPrompt, /user.s goals/i);
    assert.match(actual.systemPrompt, /project Agents own.*execution/i);
    assert.match(actual.systemPrompt, /after delegation/i);
    assert.match(actual.systemPrompt, /Keep the user's profile instructions/);
    assert.equal(actual.mode, "approve");
    assert.equal(actual.preapproved, 0);
    assert.deepEqual(actual.mcpServers, []);
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
