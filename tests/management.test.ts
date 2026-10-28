import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createIsolatedDaemon } from "./isolated-daemon.ts";
import {
  listDelegations,
  validateDelegation,
  dispatchedTargets,
} from "../client/delegations.ts";
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
    assert.match(actual.systemPrompt, /理解当前意图/);
    assert.match(actual.systemPrompt, /不强制固定阶段或技能链/);
    assert.match(actual.systemPrompt, /沿用已有明确授权/);
    assert.match(actual.systemPrompt, /项目 Agent 负责具体项目工作/);
    assert.equal(actual.mode, "approve");
    assert.equal(actual.preapproved, 0);
    assert.deepEqual(actual.mcpServers, []);
    const businessPath = join(daemon.home, "business");
    await mkdir(businessPath);
    const business = await daemon.client.workspaces.create({
      source: { kind: "directory", path: businessPath },
    });
    const outside = await business.agents.create({
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
    const receipt = {
      type: "tool_call" as const,
      callId: "actual-contract",
      name: "paseo.send_agent_prompt",
      status: "completed" as const,
      error: null,
      detail: {
        type: "unknown" as const,
        input: { agentId: unrelated.id, notifyOnFinish: true },
        output: {
          structuredContent: {
            success: true,
            deliveryStatus: "queued",
            serverId: hostId,
          },
        },
      },
    };
    const dispatched = dispatchedTargets([receipt], hostId);
    assert.deepEqual(dispatched, [unrelated.id]);
    assert.deepEqual(
      (
        await listDelegations(
          daemon.client,
          bot.id,
          hostId,
          undefined,
          dispatched,
        )
      ).map((agent) => agent.id),
      [child.id, unrelated.id],
    );
    assert.equal(
      (
        await validateDelegation(
          daemon.client,
          unrelated.id,
          bot.id,
          hostId,
          dispatched,
        )
      ).id,
      unrelated.id,
    );
    assert.equal(
      (await unrelated.refresh())?.agent.labels["paseo.parent-agent-id"],
      undefined,
    );
    assert.equal((await daemon.rpc("bootstrap", {})).conversations.length, 1);
  } finally {
    await daemon.close();
  }
});
