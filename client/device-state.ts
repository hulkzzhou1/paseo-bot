import { pendingDelivery } from "../shared/delivery.ts";
import type { z } from "zod";
type Draft = { text: string; revision: number };
export function createDeviceState(
  storage: {
    read(key: string): unknown;
    write(key: string, value: unknown): void;
  },
  host: string,
  installation: string,
) {
  const prefix = JSON.stringify([host, installation]);
  const drafts = new Map<string | null, Draft>();
  const deliveries = new Map<
    string | null,
    z.infer<typeof pendingDelivery> | null
  >();
  function key(slot: string | null) {
    return `${prefix}:draft:${JSON.stringify(slot)}`;
  }
  function draft(slot: string | null): Draft {
    const cached = drafts.get(slot);
    if (cached) return cached;
    drafts.set(slot, { text: "", revision: 0 });
    const value = storage.read(key(slot)) as Partial<Draft> | null;
    const result =
      value &&
      typeof value.text === "string" &&
      Number.isSafeInteger(value.revision)
        ? { text: value.text, revision: value.revision as number }
        : { text: "", revision: 0 };
    drafts.set(slot, result);
    return result;
  }
  function latest(slot: string | null): Draft {
    const current = draft(slot);
    const stored = storage.read(key(slot)) as Partial<Draft> | null;
    if (
      stored &&
      typeof stored.text === "string" &&
      Number.isSafeInteger(stored.revision) &&
      (stored.revision as number) >= current.revision
    ) {
      const fresh = { text: stored.text, revision: stored.revision as number };
      drafts.set(slot, fresh);
      return fresh;
    }
    return current;
  }
  function edit(slot: string | null, text: string) {
    const value = { text, revision: draft(slot).revision + 1 };
    drafts.set(slot, value);
    storage.write(key(slot), value);
    return text;
  }
  return {
    draft,
    edit,
    delivery(slot: string | null) {
      if (deliveries.has(slot)) return deliveries.get(slot) ?? null;
      const stored = storage.read(`${prefix}:delivery:${JSON.stringify(slot)}`);
      const value =
        stored === null || stored === undefined
          ? null
          : pendingDelivery.parse(stored);
      deliveries.set(slot, value);
      return value;
    },
    setDelivery(
      slot: string | null,
      value: z.infer<typeof pendingDelivery> | null,
    ) {
      storage.write(`${prefix}:delivery:${JSON.stringify(slot)}`, value);
      deliveries.set(slot, value);
    },
    created(id: string, submitted: Draft) {
      const promoted = latest(id);
      if (promoted.revision > 0) {
        storage.write(key(id), promoted);
        return promoted.text;
      }
      const current = latest(null);
      const remaining =
        current.revision === submitted.revision &&
        current.text === submitted.text
          ? ""
          : current.text;
      edit(id, remaining);
      edit(null, "");
      return remaining;
    },
    accepted(slot: string | null, submitted: Draft) {
      const current = latest(slot);
      return current.revision === submitted.revision &&
        current.text === submitted.text
        ? edit(slot, "")
        : current.text;
    },
    selection(): string | null {
      const value = storage.read(`${prefix}:selection`);
      return typeof value === "string" ? value : null;
    },
    select(id: string | null) {
      storage.write(`${prefix}:selection`, id);
    },
  };
}
