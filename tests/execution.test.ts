import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { createIsolatedDaemon } from "./isolated-daemon.ts";

test("Stop confirms only the exact owned conversation and rejects unrelated IDs", {
  timeout: 60000,
}, async () => {
  const daemon = await createIsolatedDaemon({ fixture: true });
  try {
    const conversation = await daemon.rpc("create-conversation", {
      requestId: randomUUID(),
      text: "Hello",
      config: {
        provider: "bot-test",
        model: "test-model",
        modeId: "approve",
        thinkingOptionId: "brief",
      },
    });
    await daemon.client.agents.ref(conversation.id).waitForFinish(10000);
    assert.deepEqual(
      await daemon.rpc("stop-conversation", { agentId: conversation.id }),
      { stopped: true },
    );
    await assert.rejects(
      daemon.rpc("stop-conversation", { agentId: randomUUID() }),
      /owned Bot conversation/,
    );
  } finally {
    await daemon.close();
  }
});

test("Stop leaves other Bot turns running and reports a refused cancellation", {
  timeout: 60000,
}, async () => {
  const daemon = await createIsolatedDaemon({ fixture: true });
  try {
    const start = (text: string) =>
      daemon.rpc("create-conversation", {
        requestId: randomUUID(),
        text,
        config: {
          provider: "bot-test",
          model: "test-model",
          modeId: "approve",
          thinkingOptionId: "brief",
        },
      });
    const [first, other, refused] = await Promise.all([
      start("hold first"),
      start("execution"),
      start("stop-failure"),
    ]);
    assert.equal(
      (await daemon.client.agents.ref(first.id).refresh())?.agent.status,
      "running",
    );
    assert.deepEqual(
      await daemon.rpc("stop-conversation", { agentId: first.id }),
      { stopped: true },
    );
    assert.equal(
      (await daemon.client.agents.ref(other.id).refresh())?.agent.status,
      "running",
    );
    assert.equal(
      (await daemon.client.agents.ref(other.id).refresh())?.agent
        .pendingPermissions.length,
      1,
    );
    assert.deepEqual(
      await daemon.rpc("stop-conversation", { agentId: other.id }),
      { stopped: true },
    );
    assert.equal(
      (await daemon.client.agents.ref(other.id).refresh())?.agent.activeTurn,
      null,
    );
    await assert.rejects(
      daemon.rpc("stop-conversation", { agentId: refused.id }),
      /Stop was not confirmed/,
    );
    assert.equal(
      (await daemon.client.agents.ref(refused.id).refresh())?.agent.status,
      "running",
    );
  } finally {
    await daemon.close();
  }
});

test("tool and question replies bind the owned conversation and exact pending request", {
  timeout: 60000,
}, async () => {
  const daemon = await createIsolatedDaemon({ fixture: true });
  try {
    const start = () =>
      daemon.rpc("create-conversation", {
        requestId: randomUUID(),
        text: "execution",
        config: {
          provider: "bot-test",
          model: "test-model",
          modeId: "approve",
          thinkingOptionId: "brief",
        },
      });
    const [first, other] = await Promise.all([start(), start()]);
    const handle = daemon.client.agents.ref(first.id);
    async function pending(exclude?: string) {
      for (let i = 0; i < 100; i++) {
        const found = (await handle.refresh())?.agent.pendingPermissions[0];
        if (found && found.id !== exclude) return found;
        await delay(30);
      }
      throw new Error("No pending fixture request");
    }
    const approval = await pending();
    const timeline = await handle.timeline.refetch();
    assert.ok(
      timeline.entries.some(
        ({ item }) =>
          item.type === "tool_call" &&
          item.status === "completed" &&
          item.detail.type === "shell" &&
          item.detail.output === "fixture tool success",
      ),
    );
    assert.ok(
      timeline.entries.some(
        ({ item }) =>
          item.type === "tool_call" &&
          item.status === "failed" &&
          item.error === "fixture tool failure",
      ),
    );
    await assert.rejects(
      daemon.rpc("respond-conversation", {
        agentId: other.id,
        requestId: approval.id,
        behavior: "allow",
        actionId: "approve-once",
      }),
      /no longer pending/,
    );
    await assert.rejects(
      daemon.rpc("respond-conversation", {
        agentId: first.id,
        requestId: approval.id,
        behavior: "allow",
        actionId: "unknown",
      }),
      /current request action/,
    );
    await daemon.rpc("respond-conversation", {
      agentId: first.id,
      requestId: approval.id,
      behavior: "allow",
      actionId: "approve-once",
    });
    const question = await pending(approval.id);
    assert.equal(question.kind, "question");
    await assert.rejects(
      daemon.rpc("respond-conversation", {
        agentId: first.id,
        requestId: question.id,
        behavior: "allow",
        answers: { Choice: "One, Two" },
      }),
      /Answer Secret/,
    );
    await daemon.rpc("respond-conversation", {
      agentId: first.id,
      requestId: question.id,
      behavior: "allow",
      answers: { Choice: "One, Two", Secret: "fixture-secret" },
    });
    await handle.waitForFinish(10000);
    const result = await handle.timeline.refetch();
    const reply = result.entries.find(
      ({ item }) => item.type === "assistant_message",
    );
    assert.ok(reply && reply.item.type === "assistant_message");
    const response = JSON.parse(reply.item.text);
    assert.equal(response.updatedInput.sentinel, "preserved");
    assert.deepEqual(response.updatedInput.answers, {
      Choice: "One, Two",
      Secret: "fixture-secret",
    });
    await assert.rejects(
      daemon.rpc("respond-conversation", {
        agentId: first.id,
        requestId: question.id,
        behavior: "deny",
      }),
      /no longer pending/,
    );
    const otherHandle = daemon.client.agents.ref(other.id);
    const otherRequest = (await otherHandle.refresh())?.agent
      .pendingPermissions[0];
    assert.ok(otherRequest);
    await daemon.rpc("respond-conversation", {
      agentId: other.id,
      requestId: otherRequest.id,
      behavior: "deny",
      actionId: "reject",
    });
    await otherHandle.waitForFinish(10000);
    assert.equal(
      (await otherHandle.refresh())?.agent.pendingPermissions.length,
      0,
    );
  } finally {
    await daemon.close();
  }
});
