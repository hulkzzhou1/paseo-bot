import { useState } from "react";
import { Text, View } from "react-native";
import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { HistoryMenu } from "./history.tsx";
import { userError } from "../shared/user-error.ts";
export function HistoryScreen({
  theme,
  layout,
  host,
  navigation,
  onClose,
}: PluginScreenProps & { onClose(): void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <View
      style={{ flex: 1, padding: 16, backgroundColor: theme.colors.surface0 }}
    >
      {error && (
        <Text
          accessibilityRole="alert"
          style={{ color: theme.colors.statusDanger }}
        >
          {error}
        </Text>
      )}
      <HistoryMenu
        key={host.id}
        theme={theme}
        compact={layout.compact}
        onClose={onClose}
        onSelect={(id) => {
          if (!navigation?.openAgent) {
            setError(
              "Native chat navigation is unavailable. Update or reopen Paseo.",
            );
            return;
          }
          try {
            navigation.openAgent({ agentId: id, serverId: host.id });
          } catch (reason) {
            setError(userError(reason));
          }
        }}
      />
    </View>
  );
}
