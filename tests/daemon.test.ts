import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createIsolatedDaemon } from "./isolated-daemon.ts";

test("concurrent Bot opens do not create empty conversations or duplicate workspaces", {
  timeout: 60000,
}, async () => {
  const daemon = await createIsolatedDaemon();
  try {
    const [first, second] = await Promise.all([
      daemon.rpc("bootstrap", {}),
      daemon.rpc("bootstrap", {}),
    ]);
    assert.equal(first.workspaceId, second.workspaceId);
    assert.deepEqual(first.conversations, []);
    assert.equal((await daemon.client.workspaces.list()).entries.length, 0);
  } finally {
    await daemon.close();
  }
});

test("first sends share one background workspace and retain exact conversation identity after reopen", {
  timeout: 60000,
}, async () => {
  const daemon = await createIsolatedDaemon({ fixture: true });
  try {
    const requestId = "391bfb1d-b612-4086-883f-e6d991cc98f4";
    const input = {
      requestId,
      text: "Hello",
      config: {
        provider: "bot-test",
        model: "test-model",
        modeId: "approve",
        thinkingOptionId: "brief",
      },
    };
    const [one, two] = await Promise.all([
      daemon.rpc("create-conversation", input),
      daemon.rpc("create-conversation", input),
    ]);
    assert.equal(one.id, two.id);
    const state = await daemon.rpc("bootstrap", {});
    assert.equal(state.conversations.length, 1);
    const workspace = await daemon.client.workspaces
      .ref(one.workspaceId)
      .refresh();
    assert.equal(workspace?.background, true);
    assert.equal(workspace?.workspaceDirectory, state.directory);
    const agent = daemon.client.agents.ref(one.id);
    await agent.waitForFinish(10000);
    const timeline = await agent.timeline.refetch();
    assert.equal(
      timeline.entries.filter((entry) => entry.item.type === "user_message")
        .length,
      1,
    );
    assert.ok(
      timeline.entries.some(
        (entry) =>
          entry.item.type === "assistant_message" &&
          entry.item.text.includes("complete"),
      ),
    );
    await assert.rejects(
      daemon.rpc("create-conversation", { ...input, text: "Different" }),
      /another message/,
    );
  } finally {
    await daemon.close();
  }
});

test("a model with thinking choices requires an explicit choice before creating resources", {
  timeout: 60000,
}, async () => {
  const daemon = await createIsolatedDaemon({ fixture: true });
  try {
    await assert.rejects(
      daemon.rpc("create-conversation", {
        requestId: "c716f4f3-00e3-4c5d-93eb-3019c1d56c7d",
        text: "Hello",
        config: {
          provider: "bot-test",
          model: "test-model",
          modeId: "approve",
        },
      }),
      /Choose a thinking option/,
    );
    const state = await daemon.rpc("bootstrap", {});
    assert.equal(state.workspaceId, null);
    assert.deepEqual(state.conversations, []);
  } finally {
    await daemon.close();
  }
});
