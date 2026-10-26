import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createIsolatedDaemon } from "./isolated-daemon.ts";
import { listDelegations, validateDelegation } from "../client/delegations.ts";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

test("only Bot conversations receive local management guidance without changing permissions or enabling tools", {
  timeout: 60000,
}, async () => {
  const daemon = await createIsolatedDaemon({ fixture: true });
  try {
    const bot = await daemon.rpc("create-conversation", {
      requestId: randomUUID(),
      text: "inspect-bot-config",
      config: {
        provider: "bot-test",
        model: "test-model",
        modeId: "approve",
        thinkingOptionId: "brief",
      },
    });
    async function configuration(id: string) {
      const handle = daemon.client.agents.ref(id);
      await handle.waitForFinish(10000);
      const page = await handle.timeline.refetch();
      const reply = page.entries.find(
        ({ item }) => item.type === "assistant_message",
      );
      assert.ok(reply && reply.item.type === "assistant_message");
      return JSON.parse(reply.item.text);
    }
    const actual = await configuration(bot.id);
    assert.match(actual.systemPrompt, /Paseo Bot/);
    assert.match(actual.systemPrompt, /background:false/);
    assert.match(actual.systemPrompt, /notifyOnFinish:true/);
    assert.match(actual.systemPrompt, /clarif/i);
    assert.equal(actual.mode, "approve");
    assert.equal(actual.preapproved, 0);
    assert.deepEqual(actual.mcpServers, []);
    const outside = await daemon.client.workspaces
      .ref(bot.workspaceId)
      .agents.create({
        config: { provider: "bot-test/test-model", modeId: "approve" },
        prompt: "inspect-bot-config",
      });
    const unchanged = await configuration(outside.id);
    assert.equal(unchanged.systemPrompt, undefined);
    assert.equal(unchanged.mode, "approve");
  } finally {
    await daemon.close();
  }
});

test("delegation navigation uses real same-host parent relationships and excludes unrelated or cross-host labels", {
  timeout: 60000,
}, async () => {
  const daemon = await createIsolatedDaemon({ fixture: true });
  try {
    const bot = await daemon.rpc("create-conversation", {
      requestId: randomUUID(),
      text: "Bot parent",
      config: {
        provider: "bot-test",
        model: "test-model",
        modeId: "approve",
        thinkingOptionId: "brief",
      },
    });
    const hostId = daemon.client.agents.ref(bot.id).address.serverId;
    const path = join(daemon.home, "business");
    await mkdir(path);
    const workspace = await daemon.client.workspaces.create({
      source: { kind: "directory", path },
      background: false,
    });
    assert.equal((await workspace.refresh())?.background, false);
    const child = await workspace.agents.create({
      config: { provider: "bot-test/test-model", modeId: "approve" },
      parent: bot.id,
      title: "Actual child",
    });
    const unrelated = await workspace.agents.create({
      config: { provider: "bot-test/test-model", modeId: "approve" },
      title: "Actual child",
    });
    await workspace.agents.create({
      config: { provider: "bot-test/test-model", modeId: "approve" },
      parent: bot.id,
      labels: { "paseo.parent-server-id": "different-host" },
      title: "Cross-host parent label",
    });
    const targets = await listDelegations(daemon.client, bot.id, hostId);
    assert.deepEqual(
      targets.map((agent) => agent.id),
      [child.id],
    );
    assert.equal(
      (await validateDelegation(daemon.client, child.id, bot.id, hostId))
        .workspaceId,
      workspace.id,
    );
    await assert.rejects(
      validateDelegation(daemon.client, unrelated.id, bot.id, hostId),
      /no longer a delegated target/,
    );
    await assert.rejects(
      validateDelegation(daemon.client, randomUUID(), bot.id, hostId),
      /no longer a delegated target/,
    );
    assert.equal((await daemon.rpc("bootstrap", {})).conversations.length, 1);
  } finally {
    await daemon.close();
  }
});
