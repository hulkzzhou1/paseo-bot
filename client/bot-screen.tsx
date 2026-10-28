import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRpc, type PluginScreenProps } from "@getpaseo/plugin/client";
import { openWorkspace } from "../shared/contracts.ts";
import { userError } from "../shared/user-error.ts";
import { WorkspaceLifecycle } from "./workspace-lifecycle.tsx";

const ignoreStatus = () => {};
export function BotScreen({
  theme,
  host,
  navigation,
  onOpened,
  onHistory,
}: PluginScreenProps & {
  onOpened(workspaceId: string): void;
  onHistory(): void;
}) {
  const open = useRpc(openWorkspace);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: explicit retry repeats the open operation.
  useEffect(() => {
    let active = true;
    setError(null);
    if (!navigation?.openWorkspace) {
      setError(
        "Native workspace navigation is unavailable. Update or reopen Paseo.",
      );
      return;
    }
    void open({})
      .then(({ workspaceId }) => {
        if (active) {
          onOpened(workspaceId);
          navigation.openWorkspace({ workspaceId, serverId: host.id });
        }
      })
      .catch((reason) => {
        if (active) setError(userError(reason));
      });
    return () => {
      active = false;
    };
  }, [open, host.id, navigation, attempt, onOpened]);
  return (
    <View
      style={{
        flex: 1,
        padding: 16,
        gap: 12,
        backgroundColor: theme.colors.surface0,
      }}
    >
      <Text
        accessibilityRole={error ? "alert" : undefined}
        style={{ color: theme.colors.foreground }}
      >
        {error ?? "Opening Paseo Team…"}
      </Text>
      {error && (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Bot history"
            onPress={onHistory}
            style={{ minHeight: 44, padding: 12 }}
          >
            <Text style={{ color: theme.colors.foreground }}>Bot history</Text>
          </Pressable>
          {navigation?.openWorkspace && (
            <WorkspaceLifecycle
              key={host.id}
              theme={theme}
              onChange={ignoreStatus}
            />
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry opening Paseo Bot"
            onPress={() => setAttempt((value) => value + 1)}
            style={{ minHeight: 44, padding: 12 }}
          >
            <Text style={{ color: theme.colors.foreground }}>
              Retry opening Paseo Bot
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
