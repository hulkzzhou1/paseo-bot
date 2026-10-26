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
  return [...new Map(targets.map((agent) => [agent.id, agent])).values()];
}
export async function validateDelegation(
  paseo: PaseoApi,
  id: string,
  parentId: string,
  hostId: string,
) {
  const result = await paseo.agents.ref(id).refresh();
  if (
    !result ||
    result.agent.id !== id ||
    !isDelegation(result.agent, parentId, hostId)
  )
    throw new Error(
      "This Agent is no longer a delegated target of this Bot conversation. Refresh delegated work.",
    );
  return result.agent;
}
