import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { createIsolatedDaemon } from "./isolated-daemon.ts";
import { observeConversation } from "../client/observation.ts";
import { userError } from "../shared/user-error.ts";

test("lost create/send acknowledgements reconcile without repeating Provider execution", {
  timeout: 60000,
}, async () => {
  const daemon = await createIsolatedDaemon({ fixture: true });
  try {
    const first = {
      requestId: randomUUID(),
      text: "first delivery",
      config: {
        provider: "bot-test",
        model: "test-model",
        modeId: "approve",
        thinkingOptionId: "brief",
      },
    };
    await daemon.rpc("submit-delivery", first);
    const recovered = (await daemon.rpc("reconcile-delivery", {
      requestId: first.requestId,
    })) as { state: string; conversation: { id: string } };
    assert.equal(recovered.state, "accepted");
    const handle = daemon.client.agents.ref(recovered.conversation.id);
    await handle.waitForFinish(10000);
    await promisify(execFile)(
      "paseo",
      ["plugin", "reload", "paseo-bot", "--home", daemon.home, "--json"],
      {
        env: Object.fromEntries(
          Object.entries(process.env).filter(
            ([key]) => key !== "PASEO_PASSWORD" && key !== "PASEO_HOST",
          ),
        ),
      },
    );
    await daemon.rpc("submit-delivery", first);
    const next = {
      requestId: randomUUID(),
      agentId: handle.id,
      text: "second delivery",
    };
    await daemon.rpc("submit-delivery", next);
    await handle.waitForFinish(10000);
    await daemon.rpc("submit-delivery", next);
    assert.equal(
      (
        (await daemon.rpc("reconcile-delivery", {
          requestId: next.requestId,
        })) as { state: string }
      ).state,
      "accepted",
    );
    const timeline = await handle.timeline.refetch();
    assert.equal(
      timeline.entries.filter(({ item }) => item.type === "user_message")
        .length,
      2,
    );
    assert.equal((await daemon.rpc("bootstrap", {})).conversations.length, 1);
    assert.ok(
      timeline.entries.some(
        ({ item }) =>
          item.type === "assistant_message" &&
          item.text.includes("Execution count: 2"),
      ),
    );
    await assert.rejects(
      daemon.rpc("submit-delivery", { ...next, text: "changed payload" }),
      (reason) => {
        assert.match(userError(reason), /another message/);
        assert.doesNotMatch(
          userError(reason),
          /requestType=|code=|DaemonRpcError/,
        );
        return true;
      },
    );
  } finally {
    await daemon.close();
  }
});

test("crash journals reconcile through all durable history pages and unknown markers never execute again", {
  timeout: 60000,
}, async () => {
  const daemon = await createIsolatedDaemon({ fixture: true });
  try {
    const first = {
      requestId: randomUUID(),
      text: "history-pages",
      config: {
        provider: "bot-test",
        model: "test-model",
        modeId: "approve",
        thinkingOptionId: "brief",
      },
    };
    const result = (await daemon.rpc("submit-delivery", first)) as {
      state: string;
      conversation: { id: string };
    };
    assert.equal(result.state, "accepted");
    const handle = daemon.client.agents.ref(result.conversation.id);
    await handle.waitForFinish(10000);
    const newest = await handle.timeline.refetch({ limit: 200 });
    assert.equal(newest.hasOlder, true);
    const path = join(
      daemon.home,
      "plugin-data",
      "paseo-bot",
      "deliveries.json",
    );
    const journal = JSON.parse(await readFile(path, "utf8"));
    journal[first.requestId].outcome = { state: "unknown" };
    const unknownId = randomUUID();
    journal[unknownId] = {
      hash: journal[first.requestId].hash,
      outcome: { state: "unknown" },
    };
    await writeFile(path, JSON.stringify(journal));
    assert.equal(
      (
        (await daemon.rpc("reconcile-delivery", {
          requestId: first.requestId,
        })) as { state: string }
      ).state,
      "accepted",
    );
    assert.equal(
      (
        (await daemon.rpc("submit-delivery", {
          ...first,
          requestId: unknownId,
        })) as { state: string }
      ).state,
      "unknown",
    );
    assert.equal(
      (
        (await daemon.rpc("reconcile-delivery", {
          requestId: randomUUID(),
        })) as { state: string }
      ).state,
      "ready",
    );
    let count = 0,
      seenUser = false;
    const release = observeConversation(handle, {
      timeline: (page) => {
        count = page.entries.length;
        seenUser = page.entries.some(
          ({ item }) =>
            item.type === "user_message" &&
            item.clientMessageId === first.requestId,
        );
      },
      agent: () => {},
      error: (reason) => {
        throw reason;
      },
    });
    try {
      for (let i = 0; i < 100 && !seenUser; i++) await delay(30);
      assert.ok(count > 220);
      assert.equal(seenUser, true);
    } finally {
      release();
    }
    assert.equal((await daemon.rpc("bootstrap", {})).conversations.length, 1);
    const final = await handle.timeline.refetch();
    assert.ok(
      final.entries.some(
        ({ item }) =>
          item.type === "assistant_message" &&
          item.text.includes("Execution count: 1"),
      ),
    );
  } finally {
    await daemon.close();
  }
});

test("definite configuration failure and a busy/waiting conversation do not dispatch a message", {
  timeout: 60000,
}, async () => {
  const daemon = await createIsolatedDaemon({ fixture: true });
  try {
    const first = {
      requestId: randomUUID(),
      text: "hold busy",
      config: {
        provider: "bot-test",
        model: "missing-model",
        modeId: "approve",
        thinkingOptionId: "brief",
      },
    };
    assert.equal(
      ((await daemon.rpc("submit-delivery", first)) as { state: string }).state,
      "failed",
    );
    assert.equal((await daemon.rpc("bootstrap", {})).conversations.length, 0);
    const held = (await daemon.rpc("submit-delivery", {
      ...first,
      requestId: randomUUID(),
      config: { ...first.config, model: "test-model" },
    })) as { conversation: { id: string } };
    const rejected = (await daemon.rpc("submit-delivery", {
      requestId: randomUUID(),
      agentId: held.conversation.id,
      text: "must not interrupt",
    })) as { state: string };
    assert.equal(rejected.state, "failed");
    const timeline = await daemon.client.agents
      .ref(held.conversation.id)
      .timeline.refetch();
    assert.equal(
      timeline.entries.filter(({ item }) => item.type === "user_message")
        .length,
      1,
    );
  } finally {
    await daemon.close();
  }
});
