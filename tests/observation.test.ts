import { strict as assert } from "node:assert";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";
import type { PaseoAgentTimelineEvent } from "@getpaseo/client";
import type { PaseoAgentTimelineRefetchOptions } from "@getpaseo/client";
import { observeConversation } from "../client/observation.ts";

test("a released timeline fails visibly until an explicit new observation, and ignores late responses", async () => {
  let listener: ((event: PaseoAgentTimelineEvent) => void) | undefined;
  let releases = 0;
  const source = {
    timeline: {
      async refetch() {
        return { entries: [], error: null };
      },
      subscribe(next: (event: PaseoAgentTimelineEvent) => void) {
        listener = next;
        return Object.assign(
          () => {
            releases++;
          },
          { ready: Promise.resolve() },
        );
      },
    },
    current: () => null,
    subscribe: () => () => {},
  };
  const snapshots: unknown[] = [];
  const errors: unknown[] = [];
  const callbacks = {
    timeline: (page: unknown) => snapshots.push(page),
    agent: () => {},
    error: (reason: unknown) => errors.push(reason),
  };
  const stop = observeConversation(source, callbacks);
  await setImmediate();
  assert.equal(snapshots.length, 1);
  assert.ok(listener);
  listener({
    agentId: "owned-session",
    event: { type: "error", error: "Observation released" },
  });
  await setImmediate();
  assert.deepEqual(errors, ["Observation released"]);
  listener({
    agentId: "owned-session",
    event: { type: "replacement", epoch: "later" },
  });
  await setImmediate();
  assert.equal(snapshots.length, 1);
  stop();
  const retry = observeConversation(source, callbacks);
  await setImmediate();
  assert.equal(snapshots.length, 2);
  retry();
  assert.equal(releases, 2);
});

test("history pages reconcile after replacement without publishing an obsolete epoch", async () => {
  let listener!: (event: PaseoAgentTimelineEvent) => void;
  let epoch = "old",
    olderRequested = false;
  let finishOlder!: () => void;
  const older = new Promise<void>((resolve) => {
    finishOlder = resolve;
  });
  const snapshots: string[][] = [];
  const entry = (text: string, seq: number) => ({
    provider: "bot-test",
    seqStart: seq,
    seqEnd: seq,
    sourceSeqRanges: [],
    collapsed: [],
    item: { type: "assistant_message" as const, text },
    timestamp: "2026-10-27T00:00:00Z",
  });
  const source = {
    timeline: {
      async refetch(options: PaseoAgentTimelineRefetchOptions) {
        if (options.direction === "before") {
          olderRequested = true;
          await older;
          return {
            entries: [entry("obsolete", 1)],
            error: null,
            epoch: "old",
            hasOlder: false,
            startCursor: null,
          };
        }
        return {
          entries: [entry(epoch, 3)],
          error: null,
          epoch,
          hasOlder: epoch === "old",
          startCursor: epoch === "old" ? { epoch, seq: 3 } : null,
        };
      },
      subscribe(next: (event: PaseoAgentTimelineEvent) => void) {
        listener = next;
        return Object.assign(() => {}, { ready: Promise.resolve() });
      },
    },
    current: () => null,
    subscribe: () => () => {},
  };
  const stop = observeConversation(source, {
    timeline: (page) =>
      snapshots.push(
        page.entries.map(({ item }) =>
          item.type === "assistant_message" ? item.text : "",
        ),
      ),
    agent: () => {},
    error: (reason) => {
      throw reason;
    },
  });
  await setImmediate();
  assert.equal(olderRequested, true);
  epoch = "fresh";
  listener({ agentId: "owned", event: { type: "replacement", epoch } });
  finishOlder();
  await setImmediate();
  await setImmediate();
  assert.ok(snapshots.some((snapshot) => snapshot.join() === "fresh"));
  assert.ok(
    snapshots.every(
      (snapshot) => !snapshot.includes("obsolete") && !snapshot.includes("old"),
    ),
  );
  epoch = "after reconnect";
  listener({
    agentId: "owned",
    subscriptionId: "restored",
    event: { type: "subscription_restored" },
  });
  await setImmediate();
  assert.deepEqual(snapshots.at(-1), ["after reconnect"]);
  stop();
});

test("history completing after teardown cannot replace another conversation", async () => {
  let finish!: (page: { entries: []; error: null }) => void;
  const history = new Promise<{ entries: []; error: null }>((resolve) => {
    finish = resolve;
  });
  const snapshots: unknown[] = [];
  const errors: unknown[] = [];
  const stop = observeConversation(
    {
      timeline: {
        refetch: () => history,
        subscribe: () => Object.assign(() => {}, { ready: Promise.resolve() }),
      },
      current: () => null,
      subscribe: () => () => {},
    },
    {
      timeline: (page) => snapshots.push(page),
      agent: () => {},
      error: (reason) => errors.push(reason),
    },
  );
  await setImmediate();
  stop();
  finish({ entries: [], error: null });
  await setImmediate();
  assert.deepEqual(snapshots, []);
  assert.deepEqual(errors, []);
});
