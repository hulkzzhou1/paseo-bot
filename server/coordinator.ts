import type { PaseoApi } from "@getpaseo/client";
import type { AgentProfile } from "@getpaseo/protocol/messages";
import type { AgentSessionConfig } from "@getpaseo/protocol/agent-types";
import { managementPrompt } from "./management.ts";

export async function readProfiles(paseo: PaseoApi) {
  try {
    return (await paseo.config.get()).config.agentProfiles ?? [];
  } catch {
    throw new Error(
      "Could not read Agent presets. Check the connection and retry; the preset state is unknown.",
    );
  }
}

export function runtimeFields(profile: AgentProfile) {
  return {
    provider: profile.provider.trim(),
    ...(profile.model?.trim() ? { model: profile.model.trim() } : {}),
    ...(profile.modeId?.trim() ? { modeId: profile.modeId.trim() } : {}),
    ...(profile.thinkingOptionId?.trim()
      ? { thinkingOptionId: profile.thinkingOptionId.trim() }
      : {}),
    ...(profile.featureValues ? { featureValues: profile.featureValues } : {}),
  };
}

export async function resolveCoordinator(
  paseo: PaseoApi,
  association: { id: string; initialized: boolean } | undefined,
  input: AgentSessionConfig,
  requireProfileModel = false,
) {
  if (association && !association.initialized)
    throw new Error(
      "Coordinator preset setup is incomplete. Open Paseo Team to check its creation outcome.",
    );
  const profile = association
    ? (await readProfiles(paseo)).find(
        (profile) => profile.id === association.id,
      )
    : undefined;
  if (!profile) return { config: input, notes: managementPrompt };
  const fields = runtimeFields(profile);
  if (
    fields.provider !== input.provider ||
    (fields.modeId && fields.modeId !== input.modeId)
  )
    throw new Error(
      `Select the Coordinator preset “${profile.name}” in the native picker before sending. Its provider and permission mode must match; explicit RPC input must match too.`,
    );
  if (requireProfileModel && !fields.model)
    throw new Error(
      "Set an explicit model in the Coordinator preset before using legacy creation.",
    );
  return {
    config: {
      ...input,
      ...fields,
      ...(fields.featureValues
        ? { featureValues: { ...input.featureValues, ...fields.featureValues } }
        : {}),
    },
    notes: profile.notes ?? "",
  };
}
