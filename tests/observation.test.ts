import { strict as assert } from "node:assert";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";
import type { PaseoAgentTimelineEvent } from "@getpaseo/client";
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
