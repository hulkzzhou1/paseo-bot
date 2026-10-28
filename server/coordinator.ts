import type { PaseoApi } from "@getpaseo/client";
import type { AgentProfile } from "@getpaseo/protocol/messages";
import type { AgentSessionConfig } from "@getpaseo/protocol/agent-types";
import { managementPrompt } from "./management.ts";

export function configAccessDenied(error: unknown) {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error.code === "access_denied" || error.code === "permission_denied")
  );
}

export async function readProfiles(paseo: PaseoApi) {
  try {
    return (await paseo.config.get()).config.agentProfiles ?? [];
  } catch (error) {
    if (configAccessDenied(error))
      throw new Error(
        "Permission denied reading Agent presets. Restore configuration access and retry; this does not confirm preset deletion.",
      );
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
  legacy = false,
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
  let config = input;
  if (profile) {
    const fields = runtimeFields(profile);
    if (
      fields.provider !== input.provider ||
      (fields.modeId && fields.modeId !== input.modeId)
    )
      throw new Error(
        `Select the Coordinator preset “${profile.name}” in the native picker before sending. Its provider and permission mode must match; explicit RPC input must match too.`,
      );
    if (legacy && !fields.model)
      throw new Error(
        "Set an explicit model in the Coordinator preset before using legacy creation.",
      );
    config = {
      ...input,
      ...fields,
      ...(fields.featureValues
        ? { featureValues: { ...input.featureValues, ...fields.featureValues } }
        : {}),
    };
  }
  const snapshot = await paseo.providers.waitForReady({ cwd: input.cwd });
  const provider = snapshot.entries.find(
    (entry) =>
      entry.provider === config.provider &&
      entry.enabled &&
      entry.status === "ready",
  );
  const models =
    provider?.models?.filter((model) => model.isSelectable !== false) ?? [];
  // Match host validation without filling omitted native configuration fields.
  const requestedModel = config.model;
  const model = requestedModel
    ? models.find(
        (model) =>
          model.id === requestedModel ||
          model.aliases?.includes(requestedModel),
      )
    : (models.find((model) => model.isDefault) ?? models[0]);
  if (!provider || (config.model && !model))
    throw new Error(
      "The selected provider or model is unavailable. Choose again.",
    );
  if (
    config.modeId &&
    !provider.modes?.some((mode) => mode.id === config.modeId)
  )
    throw new Error(
      "The selected permission mode is unavailable. Choose again.",
    );
  if (legacy && model?.thinkingOptions?.length && !config.thinkingOptionId)
    throw new Error("Choose a thinking option before sending.");
  if (
    config.thinkingOptionId &&
    !model?.thinkingOptions?.some(
      (option) => option.id === config.thinkingOptionId,
    )
  )
    throw new Error(
      "The selected thinking option is unavailable. Choose again.",
    );
  return { config, notes: profile ? (profile.notes ?? "") : managementPrompt };
}
