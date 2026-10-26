import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { usePaseo, type PluginScreenProps } from "@getpaseo/plugin/client";
import type { PaseoAgent, PaseoAgentListResult } from "@getpaseo/client";
import {
  listDelegations,
  validateDelegation,
  parentAgentLabel,
} from "./delegations.ts";
import { userError } from "../shared/user-error.ts";
export function DelegatedTargets({
  parentId,
  hostId,
  theme,
  navigation,
}: {
  parentId: string;
  hostId: string;
  theme: PluginScreenProps["theme"];
  navigation: PluginScreenProps["navigation"];
}) {
  const paseo = usePaseo();
  const [targets, setTargets] = useState<PaseoAgent[]>([]),
    [error, setError] = useState<string | null>(null),
    [attempt, setAttempt] = useState(0),
    [opening, setOpening] = useState(false);
  const alive = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: explicit retry replaces a failed owned observation.
  useEffect(() => {
    alive.current = true;
    let active = true,
      reading = false,
      again = false;
    const lifetime = new AbortController();
    let subscription: PaseoAgentListResult["subscription"];
    let detach: (() => void) | undefined;
    async function refresh() {
      if (!active) return;
      if (reading) {
        again = true;
        return;
      }
      reading = true;
      try {
        const next = await listDelegations(
          paseo,
          parentId,
          hostId,
          lifetime.signal,
        );
        if (active) {
          setTargets(next);
          setError(null);
        }
      } catch (reason) {
        if (active) setError(userError(reason));
      } finally {
        reading = false;
        if (active && again) {
          again = false;
          void refresh();
        }
      }
    }
    void paseo.agents
      .list({
        filter: {
          labels: { [parentAgentLabel]: parentId },
          includeArchived: true,
          includeBackground: true,
        },
        subscribe: {},
        signal: lifetime.signal,
      })
      .then(async (snapshot) => {
        subscription = snapshot.subscription;
        if (!active) {
          await subscription.release();
          return;
        }
        detach = subscription.subscribe({
          snapshot: () => void refresh(),
          update: () => void refresh(),
          error: (reason) => {
            if (active) setError(userError(reason));
          },
        });
        await subscription.ready;
        if (active) void refresh();
      })
      .catch((reason) => {
        if (active) setError(userError(reason));
      });
    return () => {
      active = false;
      alive.current = false;
      lifetime.abort();
      detach?.();
      void subscription?.release().catch(() => {});
    };
  }, [paseo, parentId, hostId, attempt]);
  async function open(id: string, workspace: boolean) {
    if (opening || !navigation) return;
    setOpening(true);
    setError(null);
    try {
      const target = await validateDelegation(paseo, id, parentId, hostId);
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
  if (!targets.length && !error) return null;
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
      {error && (
        <>
          <Text
            accessibilityRole="alert"
            style={{ color: theme.colors.statusDanger }}
          >
            {error}
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
