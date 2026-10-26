import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createDeviceState } from "../client/device-state.ts";
import { randomUUID } from "node:crypto";

test("drafts and last selection persist per browser, host, installation and slot; accepted sends clear only the submitted revision", () => {
  const values = new Map<string, unknown>();
  const storage = {
    read: (key: string) => values.get(key),
    write: (key: string, value: unknown) => {
      values.set(key, value);
    },
  };
  const device = createDeviceState(storage, "host-a", "install-a");
  device.edit(null, "new draft");
  device.edit("one", "send this");
  const submitted = device.draft("one");
  device.edit("one", "send this edited");
  device.edit("one", "send this");
  assert.equal(device.accepted("one", submitted), "send this");
  device.select("one");
  const reopened = createDeviceState(storage, "host-a", "install-a");
  assert.equal(reopened.selection(), "one");
  assert.equal(reopened.draft(null).text, "new draft");
  assert.equal(reopened.draft("one").text, "send this");
  assert.equal(reopened.accepted("one", reopened.draft("one")), "");
  assert.equal(
    createDeviceState(storage, "host-b", "install-a").draft(null).text,
    "",
  );
  assert.equal(
    createDeviceState(storage, "host-a", "install-b").selection(),
    null,
  );
  const otherBrowser = createDeviceState(
    { read: () => null, write: () => {} },
    "host-a",
    "install-a",
  );
  assert.equal(otherBrowser.draft(null).text, "");
  assert.equal(otherBrowser.selection(), null);
});

test("an unresolved delivery keeps its exact identity and submitted draft revision across page recreation", () => {
  const values = new Map<string, unknown>();
  const storage = {
    read: (key: string) => values.get(key),
    write: (key: string, value: unknown) => {
      values.set(key, value);
    },
  };
  const device = createDeviceState(storage, "host", "install");
  device.edit(null, "original task");
  const pending = {
    slot: null,
    input: {
      requestId: randomUUID(),
      text: "original task",
      config: { provider: "bot-test", model: "test-model", modeId: "approve" },
    },
    ...device.draft(null),
  };
  device.setDelivery(null, pending);
  device.edit(null, "newer edits");
  const reopened = createDeviceState(storage, "host", "install");
  assert.deepEqual(reopened.delivery(null), pending);
  assert.equal(reopened.accepted(null, pending), "newer edits");
  reopened.setDelivery(null, null);
  assert.equal(
    createDeviceState(storage, "host", "install").delivery(null),
    null,
  );
});

test("storage failure is reported while edited drafts remain usable in memory", () => {
  const device = createDeviceState(
    {
      read: () => {
        throw new Error("blocked");
      },
      write: () => {
        throw new Error("quota");
      },
    },
    "host",
    "install",
  );
  assert.throws(() => device.draft("one"), /blocked/);
  assert.throws(() => device.edit("one", "keep me"), /quota/);
  assert.equal(device.draft("one").text, "keep me");
});

test("accepted first send promotes newer edits to its created conversation without losing an independent new draft after navigation", () => {
  const values = new Map<string, unknown>();
  const device = createDeviceState(
    {
      read: (key) => values.get(key),
      write: (key, value) => {
        values.set(key, value);
      },
    },
    "host",
    "install",
  );
  device.edit(null, "first message");
  const submitted = device.draft(null);
  device.edit(null, "next message typed while sending");
  assert.equal(
    device.created("created", submitted),
    "next message typed while sending",
  );
  assert.equal(
    device.draft("created").text,
    "next message typed while sending",
  );
  assert.equal(device.draft(null).text, "");
});

test("a late acknowledgement from an earlier host visit cannot erase a newer stored draft revision", () => {
  const values = new Map<string, unknown>();
  const storage = {
    read: (key: string) => values.get(key),
    write: (key: string, value: unknown) => {
      values.set(key, value);
    },
  };
  const earlierVisit = createDeviceState(storage, "host-a", "install");
  earlierVisit.edit("one", "submitted before navigating away");
  const submitted = earlierVisit.draft("one");
  const returnVisit = createDeviceState(storage, "host-a", "install");
  returnVisit.edit("one", "newer text after returning to host-a");
  assert.equal(
    earlierVisit.accepted("one", submitted),
    "newer text after returning to host-a",
  );
  assert.equal(
    createDeviceState(storage, "host-a", "install").draft("one").text,
    "newer text after returning to host-a",
  );
});

test("checking an accepted creation twice cannot overwrite edits already promoted to its conversation", () => {
  const values = new Map<string, unknown>();
  const storage = {
    read: (key: string) => values.get(key),
    write: (key: string, value: unknown) => {
      values.set(key, value);
    },
  };
  const device = createDeviceState(storage, "host", "install");
  device.edit(null, "sent");
  const submitted = device.draft(null);
  device.edit(null, "followup");
  device.created("created", submitted);
  device.edit("created", "newer followup");
  assert.equal(device.created("created", submitted), "newer followup");
  assert.equal(
    createDeviceState(storage, "host", "install").draft("created").text,
    "newer followup",
  );
});
