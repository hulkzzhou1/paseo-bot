import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { usePaseo, type PluginScreenProps } from "@getpaseo/plugin/client";
import type { PaseoAgent } from "@getpaseo/client";
import {
  listDelegations,
  dispatchedTargets,
  observeDelegations,
  validateDelegation,
  parentAgentLabel,
} from "./delegations.ts";
import type { AgentTimelineItem } from "@getpaseo/protocol/agent-types";
import { userError } from "../shared/user-error.ts";
export function DelegatedTargets({
  parentId,
  hostId,
  theme,
  navigation,
  timeline,
}: {
  parentId: string;
  hostId: string;
  theme: PluginScreenProps["theme"];
  navigation: PluginScreenProps["navigation"];
  timeline: readonly AgentTimelineItem[];
}) {
  const paseo = usePaseo();
  const [targets, setTargets] = useState<PaseoAgent[]>([]),
    [error, setError] = useState<string | null>(null),
    [observationError, setObservationError] = useState<string | null>(null),
    [attempt, setAttempt] = useState(0),
    [opening, setOpening] = useState(false);
  const alive = useRef(true);
  const dispatchedKey = dispatchedTargets(timeline, hostId).join(",");
  const dispatched = dispatchedKey ? dispatchedKey.split(",") : [];
  // biome-ignore lint/correctness/useExhaustiveDependencies: explicit retry replaces a failed owned observation.
  useEffect(() => {
    alive.current = true;
    const stop = observeDelegations(
      {
        async watch(signal) {
          const result = await paseo.agents.list({
            filter: {
              labels: dispatchedKey
                ? undefined
                : { [parentAgentLabel]: parentId },
              includeArchived: true,
              includeBackground: true,
            },
            subscribe: {},
            signal,
          });
          return result.subscription;
        },
        read: (signal) =>
          listDelegations(paseo, parentId, hostId, signal, dispatched),
      },
      {
        targets(next) {
          setTargets(next);
          setObservationError(null);
        },
        error(reason) {
          setObservationError(userError(reason));
        },
      },
    );
    return () => {
      alive.current = false;
      stop();
    };
  }, [paseo, parentId, hostId, attempt, dispatchedKey]);
  async function open(id: string, workspace: boolean) {
    if (opening || !navigation) return;
    setOpening(true);
    setError(null);
    try {
      const target = await validateDelegation(
        paseo,
        id,
        parentId,
        hostId,
        dispatched,
      );
      if (workspace) {
        if (!target.workspaceId)
          throw new Error("The delegated Agent has no workspace.");
        const current = await paseo.workspaces
          .ref(target.workspaceId)
          .refresh();
        if (!current)
          throw new Error(
            "The delegated workspace is archived or unavailable. Open its Agent to inspect the saved conversation.",
          );
        if (alive.current)
          navigation.openWorkspace({
            workspaceId: current.id,
            serverId: hostId,
          });
      } else if (alive.current)
        navigation.openAgent({ agentId: target.id, serverId: hostId });
    } catch (reason) {
      if (alive.current) setError(userError(reason));
    } finally {
      if (alive.current) setOpening(false);
    }
  }
  const visibleError = observationError ?? error;
  if (!targets.length && !visibleError) return null;
  function action(label: string, onPress: () => void, disabled = false) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={{
          minHeight: 44,
          padding: 10,
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: 6,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Text style={{ color: theme.colors.foreground, fontSize: 13 }}>
          {label}
        </Text>
      </Pressable>
    );
  }
  return (
    <View
      style={{
        padding: 12,
        gap: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 8,
        backgroundColor: theme.colors.surface1,
      }}
    >
      <Text style={{ color: theme.colors.foregroundMuted, fontSize: 13 }}>
        Delegated work
      </Text>
      {targets.map((target) => (
        <View key={target.id} style={{ gap: 4 }}>
          <Text style={{ color: theme.colors.foreground, fontSize: 14 }}>
            {target.title ?? target.id}
          </Text>
          <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>
            {target.pendingPermissions.length
              ? "waiting for confirmation"
              : target.status}{" "}
            · {target.id.slice(0, 8)}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {action(
              `Open Agent ${target.title ?? target.id}`,
              () => void open(target.id, false),
              opening || !navigation,
            )}
            {target.workspaceId &&
              action(
                `Open workspace for ${target.title ?? target.id}`,
                () => void open(target.id, true),
                opening || !navigation,
              )}
          </View>
        </View>
      ))}
      {!navigation && (
        <Text style={{ color: theme.colors.statusWarning }}>
          Target navigation is unavailable in this Paseo client.
        </Text>
      )}
      {visibleError && (
        <>
          <Text
            accessibilityRole="alert"
            style={{ color: theme.colors.statusDanger }}
          >
            {visibleError}
          </Text>
          {action(
            "Refresh delegated work",
            () => setAttempt((value) => value + 1),
            opening,
          )}
        </>
      )}
    </View>
  );
}
