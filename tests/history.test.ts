import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createIsolatedDaemon } from "./isolated-daemon.ts";

test("history pages only exact owned conversations by activity and rename persists through the daemon", {
  timeout: 60000,
}, async () => {
  const daemon = await createIsolatedDaemon({ fixture: true });
  try {
    const conversations: { id: string; workspaceId: string }[] = [];
    for (const text of ["First task", "Second task", "Third task"]) {
      const conversation = await daemon.rpc("create-conversation", {
        requestId: randomUUID(),
        text,
        config: {
          provider: "bot-test",
          model: "test-model",
          modeId: "approve",
          thinkingOptionId: "brief",
        },
      });
      await daemon.client.agents.ref(conversation.id).waitForFinish(10000);
      conversations.push(conversation);
    }
    const outsider = await daemon.client.workspaces
      .ref(conversations[0].workspaceId)
      .agents.create({
        config: { provider: "bot-test/test-model", modeId: "approve" },
        title: "First task",
      });
    const first = await daemon.rpc("list-conversations", { limit: 2 });
    assert.deepEqual(
      first.entries.map((entry) => entry.id),
      [conversations[2].id, conversations[1].id],
    );
    assert.ok(first.nextCursor);
    const second = await daemon.rpc("list-conversations", {
      limit: 2,
      cursor: first.nextCursor,
    });
    assert.deepEqual(
      second.entries.map((entry) => entry.id),
      [conversations[0].id],
    );
    assert.equal(second.nextCursor, null);
    assert.equal(first.entries[0].title, "Third task");
    assert.equal(first.entries[0].status, "idle");
    await assert.rejects(
      daemon.rpc("rename-conversation", {
        id: outsider.id,
        title: "Forbidden",
      }),
      /owned|Bot conversation/,
    );
    await daemon.rpc("rename-conversation", {
      id: conversations[0].id,
      title: "Updated title",
    });
    assert.equal(
      (await daemon.client.agents.ref(conversations[0].id).refresh())?.agent
        .title,
      "Updated title",
    );
    const renamed = await daemon.rpc("list-conversations", {});
    assert.equal(
      renamed.entries.find((entry) => entry.id === conversations[0].id)?.title,
      "Updated title",
    );
    await daemon.client.agents.ref(conversations[1].id).archive();
    const final = await daemon.rpc("list-conversations", {});
    assert.equal(final.entries.length, 2);
    assert.ok(
      final.entries.every(
        (entry) => entry.id !== conversations[1].id && entry.id !== outsider.id,
      ),
    );
  } finally {
    await daemon.close();
  }
});
