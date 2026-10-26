import type {
  PaseoAgent,
  PaseoAgentHandle,
  PaseoAgentTimelineEvent,
  PaseoAgentTimelineRefetchOptions,
} from "@getpaseo/client";
type Page = Awaited<ReturnType<PaseoAgentHandle["timeline"]["refetch"]>>;
type TimelinePage = Pick<Page, "entries" | "error"> &
  Partial<
    Pick<
      Page,
      "epoch" | "hasOlder" | "startCursor" | "reset" | "staleCursor" | "gap"
    >
  >;
type ConversationSource = {
  timeline: {
    refetch(options: PaseoAgentTimelineRefetchOptions): Promise<TimelinePage>;
    subscribe(
      listener: (event: PaseoAgentTimelineEvent) => void,
    ): (() => void) & { ready: Promise<unknown> };
  };
  current(): PaseoAgent | null;
  refresh?(): Promise<unknown>;
  subscribe(listener: () => void): () => void;
};
export function observeConversation(
  handle: ConversationSource,
  callbacks: {
    timeline(page: TimelinePage): void;
    agent(agent: PaseoAgent | null): void;
    error(reason: unknown): void;
    loading?(value: boolean): void;
  },
) {
  let active = true,
    reading = false,
    again = false,
    failed = false,
    generation = 0,
    invalidations = 0;
  function fail(reason: unknown) {
    if (!active || failed) return;
    failed = true;
    callbacks.error(reason);
    callbacks.loading?.(false);
  }
  async function refresh() {
    if (!active || failed) return;
    if (reading) {
      again = true;
      return;
    }
    reading = true;
    const visit = generation;
    callbacks.loading?.(true);
    try {
      let page = await handle.timeline.refetch({ limit: 200 });
      const epoch = page.epoch;
      let entries = page.entries;
      for (;;) {
        if (!active || failed || visit !== generation) return;
        if (page.error) throw new Error(page.error);
        if (page.epoch !== epoch || page.staleCursor || page.gap) {
          if (++invalidations >= 3)
            throw new Error(
              "History changed while loading. Retry live updates.",
            );
          again = true;
          generation++;
          return;
        }
        if (!page.hasOlder || !page.startCursor) break;
        page = await handle.timeline.refetch({
          direction: "before",
          cursor: page.startCursor,
          limit: 200,
        });
        entries = [...page.entries, ...entries];
      }
      await handle.refresh?.();
      if (active && !failed && visit === generation) {
        invalidations = 0;
        const unique = new Map(entries.map((entry) => [entry.seqStart, entry]));
        callbacks.timeline({
          entries: [...unique.values()].sort((a, b) => a.seqStart - b.seqStart),
          error: null,
          epoch,
        });
        callbacks.agent(handle.current());
        callbacks.loading?.(false);
      }
    } catch (reason) {
      if (visit === generation) fail(reason);
    } finally {
      reading = false;
      if (again && active && !failed) {
        again = false;
        void refresh();
      }
    }
  }
  callbacks.loading?.(true);
  const unsubscribe = handle.timeline.subscribe(({ event }) => {
    if (event.type === "error") {
      fail(event.error);
      return;
    }
    if (
      event.type === "replacement" ||
      event.type === "subscription_restored"
    ) {
      generation++;
      if (active && !failed) {
        callbacks.loading?.(true);
        if (event.type === "replacement")
          callbacks.timeline({ entries: [], error: null });
      }
    }
    void refresh();
  });
  const updates = handle.subscribe(() => {
    if (active && !failed) callbacks.agent(handle.current());
  });
  void unsubscribe.ready.then(refresh).catch(fail);
  return () => {
    active = false;
    generation++;
    unsubscribe();
    updates();
  };
}
