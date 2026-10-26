import type {
  PaseoAgent,
  PaseoAgentHandle,
  PaseoAgentTimelineEvent,
} from "@getpaseo/client";
type TimelinePage = Pick<
  Awaited<ReturnType<PaseoAgentHandle["timeline"]["refetch"]>>,
  "entries" | "error"
>;
type ConversationSource = {
  timeline: {
    refetch(options: { limit: number }): Promise<TimelinePage>;
    subscribe(
      listener: (event: PaseoAgentTimelineEvent) => void,
    ): (() => void) & { ready: Promise<unknown> };
  };
  current(): PaseoAgent | null;
  subscribe(listener: () => void): () => void;
};
export function observeConversation(
  handle: ConversationSource,
  callbacks: {
    timeline(page: TimelinePage): void;
    agent(agent: PaseoAgent | null): void;
    error(reason: unknown): void;
  },
) {
  let active = true,
    reading = false,
    again = false,
    failed = false;
  function fail(reason: unknown) {
    if (!active || failed) return;
    failed = true;
    callbacks.error(reason);
  }
  async function refresh() {
    if (!active || failed) return;
    if (reading) {
      again = true;
      return;
    }
    reading = true;
    try {
      const page = await handle.timeline.refetch({ limit: 200 });
      if (page.error) throw new Error(page.error);
      if (active && !failed) {
        callbacks.timeline(page);
        callbacks.agent(handle.current());
      }
    } catch (reason) {
      fail(reason);
    } finally {
      reading = false;
      if (again && active && !failed) {
        again = false;
        void refresh();
      }
    }
  }
  const unsubscribe = handle.timeline.subscribe(({ event }) => {
    if (event.type === "error") {
      fail(event.error);
      return;
    }
    void refresh();
  });
  const updates = handle.subscribe(() => {
    if (active && !failed) callbacks.agent(handle.current());
  });
  void unsubscribe.ready.then(refresh).catch(fail);
  return () => {
    active = false;
    unsubscribe();
    updates();
  };
}
