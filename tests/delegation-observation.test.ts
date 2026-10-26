import { strict as assert } from "node:assert";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { observeDelegations } from "../client/delegations.ts";

test("terminal delegation observation cannot be revived by a late read; explicit retry owns a fresh subscription", async () => {
  let events!: {
    snapshot(): void;
    update(): void;
    error(reason: unknown): void;
  };
  let finish!: (value: []) => void;
  let releases = 0,
    reads = 0;
  const errors: unknown[] = [];
  const snapshots: unknown[] = [];
  const source = {
    async watch() {
      return {
        ready: Promise.resolve(),
        subscribe(next: typeof events) {
          events = next;
          return () => {};
        },
        async release() {
          releases++;
        },
      };
    },
    read() {
      reads++;
      return reads === 1
        ? new Promise<[]>((resolve) => {
            finish = resolve;
          })
        : Promise.resolve([]);
    },
  };
  const callbacks = {
    targets(value: unknown) {
      snapshots.push(value);
      errors.push(null);
    },
    error(reason: unknown) {
      errors.push(reason);
    },
  };
  const stop = observeDelegations(source, callbacks);
  await setImmediate();
  events.error("terminal");
  finish([]);
  events.snapshot();
  events.update();
  await setImmediate();
  assert.deepEqual(errors, ["terminal"]);
  assert.equal(reads, 1);
  assert.deepEqual(snapshots, []);
  stop();
  const retry = observeDelegations(source, callbacks);
  await setImmediate();
  assert.deepEqual(errors, ["terminal", null]);
  assert.equal(snapshots.length, 1);
  retry();
  assert.equal(releases, 2);
});

test("delegation watch resolving after teardown is released without publishing or reading", async () => {
  let finish!: () => void;
  let releases = 0;
  const waiting = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const stop = observeDelegations(
    {
      async watch() {
        await waiting;
        return {
          ready: Promise.resolve(),
          subscribe() {
            throw Error("late subscribe");
          },
          async release() {
            releases++;
          },
        };
      },
      async read() {
        throw Error("late read");
      },
    },
    {
      targets() {
        assert.fail("late targets");
      },
      error() {
        assert.fail("late error");
      },
    },
  );
  stop();
  finish();
  await setImmediate();
  assert.equal(releases, 1);
});
