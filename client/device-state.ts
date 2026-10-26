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
  function edit(slot: string | null, text: string) {
    const value = { text, revision: draft(slot).revision + 1 };
    drafts.set(slot, value);
    storage.write(key(slot), value);
    return text;
  }
  return {
    draft,
    edit,
    created(id: string, submitted: Draft) {
      const current = draft(null);
      const remaining =
        current.revision === submitted.revision ? "" : current.text;
      edit(id, remaining);
      edit(null, "");
      return remaining;
    },
    accepted(slot: string | null, submitted: Draft) {
      const current = draft(slot);
      return current.revision === submitted.revision
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
