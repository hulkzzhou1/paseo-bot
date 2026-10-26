import type { AgentTimelineItem } from "@getpaseo/protocol/agent-types";
import type { PaseoApi, PaseoAgent } from "@getpaseo/client";
// Public Agent label contract; client plugins cannot import protocol runtime modules.
export const parentAgentLabel = "paseo.parent-agent-id";
const parentServerLabel = "paseo.parent-server-id";
export function isDelegation(
  agent: PaseoAgent,
  parentId: string,
  hostId: string,
) {
  const parent = agent.labels[parentAgentLabel]?.trim();
  const server = agent.labels[parentServerLabel]?.trim() || hostId;
  return parent === parentId && server === hostId;
}
export async function listDelegations(
  paseo: PaseoApi,
  parentId: string,
  hostId: string,
  signal?: AbortSignal,
  dispatched: readonly string[] = [],
) {
  const targets: PaseoAgent[] = [];
  let cursor: string | undefined;
  do {
    const page = await paseo.agents.list({
      filter: {
        labels: { [parentAgentLabel]: parentId },
        includeArchived: true,
        includeBackground: true,
      },
      page: { limit: 100, cursor },
      signal,
    });
    if (signal?.aborted) throw new Error("Target observation ended");
    targets.push(
      ...page.entries
        .map((entry) => entry.agent)
        .filter((agent) => isDelegation(agent, parentId, hostId)),
    );
    cursor = page.pageInfo.hasMore
      ? (page.pageInfo.nextCursor ?? undefined)
      : undefined;
  } while (cursor);
  for (const id of dispatched) {
    const current = await paseo.agents.ref(id).refresh();
    if (signal?.aborted) throw new Error("Target observation ended");
    if (current?.agent.id === id) targets.push(current.agent);
  }
  return [...new Map(targets.map((agent) => [agent.id, agent])).values()];
}
export async function validateDelegation(
  paseo: PaseoApi,
  id: string,
  parentId: string,
  hostId: string,
  dispatched: readonly string[] = [],
) {
  const result = await paseo.agents.ref(id).refresh();
  if (
    !result ||
    result.agent.id !== id ||
    (!isDelegation(result.agent, parentId, hostId) && !dispatched.includes(id))
  )
    throw new Error(
      "This Agent is no longer a delegated target of this Bot conversation. Refresh delegated work.",
    );
  return result.agent;
}

type DelegationWatch = {
  ready: Promise<unknown>;
  subscribe(observer: {
    snapshot(): void;
    update(): void;
    error(reason: unknown): void;
  }): () => void;
  release(): Promise<void>;
};
export function observeDelegations(
  source: {
    watch(signal: AbortSignal): Promise<DelegationWatch>;
    read(signal: AbortSignal): Promise<PaseoAgent[]>;
  },
  callbacks: {
    targets(agents: PaseoAgent[]): void;
    error(reason: unknown): void;
  },
) {
  let active = true,
    reading = false,
    again = false,
    failed = false;
  const lifetime = new AbortController();
  let subscription: DelegationWatch | undefined;
  let detach: (() => void) | undefined;
  function release() {
    detach?.();
    detach = undefined;
    const watch = subscription;
    subscription = undefined;
    void watch?.release().catch(() => {});
  }
  function fail(reason: unknown) {
    if (!active || failed) return;
    failed = true;
    lifetime.abort();
    release();
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
      const next = await source.read(lifetime.signal);
      if (active && !failed) callbacks.targets(next);
    } catch (reason) {
      fail(reason);
    } finally {
      reading = false;
      if (active && !failed && again) {
        again = false;
        void refresh();
      }
    }
  }
  void source
    .watch(lifetime.signal)
    .then(async (watch) => {
      subscription = watch;
      if (!active || failed) {
        release();
        return;
      }
      detach = subscription.subscribe({
        snapshot: () => void refresh(),
        update: () => void refresh(),
        error: fail,
      });
      if (failed) {
        release();
        return;
      }
      await watch.ready;
      if (active && !failed) void refresh();
    })
    .catch(fail);
  return () => {
    active = false;
    lifetime.abort();
    release();
  };
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
export function dispatchedTargets(
  items: readonly AgentTimelineItem[],
  hostId: string,
): string[] {
  const ids = new Set<string>();
  for (const item of items) {
    if (
      item.type !== "tool_call" ||
      item.status !== "completed" ||
      item.error !== null ||
      !["paseo.send_agent_prompt", "send_agent_prompt"].includes(item.name) ||
      item.detail.type !== "unknown"
    )
      continue;
    const input = record(item.detail.input),
      output = record(item.detail.output);
    const result = record(output?.structuredContent);
    if (
      !input ||
      !output ||
      !result ||
      result.success !== true ||
      result.serverId !== hostId ||
      (output.isError !== undefined && output.isError !== false) ||
      (input.destinationHostId !== undefined &&
        input.destinationHostId !== hostId) ||
      (input.serverId !== undefined && input.serverId !== hostId)
    )
      continue;
    const id = input.agentId;
    if (
      typeof id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    )
      ids.add(id);
  }
  return [...ids].sort();
}
