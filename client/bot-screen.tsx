import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text } from "react-native";
import type { RpcOutput } from "@getpaseo/plugin";
import { useRpc, type PluginScreenProps } from "@getpaseo/plugin/client";
import { openWorkspace } from "../shared/contracts.ts";
import { prepareCoordinator } from "../shared/coordinator.ts";
import { userError } from "../shared/user-error.ts";
import { WorkspaceLifecycle } from "./workspace-lifecycle.tsx";

const ignoreStatus = () => {};
export function BotScreen({
  theme,
  host,
  navigation,
  layout,
  onOpened,
  onHistory,
}: PluginScreenProps & {
  onOpened(workspaceId: string): void;
  onHistory(): void;
}) {
  const open = useRpc(openWorkspace);
  const prepare = useRpc(prepareCoordinator);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<RpcOutput<
    typeof prepareCoordinator
  > | null>(null);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: explicit retry repeats the open operation.
  useEffect(() => {
    let active = true;
    generation.current++;
    setError(null);
    setSetup(null);
    if (!navigation?.openWorkspace) {
      setError(
        "Native workspace navigation is unavailable. Update or reopen Paseo.",
      );
      return;
    }
    void prepare({})
      .then((result) => {
        if (active) setSetup(result);
      })
      .catch((reason) => {
        if (active) setError(userError(reason));
      });
    return () => {
      active = false;
      generation.current++;
    };
  }, [prepare, host.id, navigation, attempt]);
  async function chooseSource(sourceProfileId: string) {
    const current = generation.current;
    setBusy(true);
    setError(null);
    try {
      const result = await prepare({ sourceProfileId });
      if (current === generation.current) setSetup(result);
    } catch (reason) {
      if (current === generation.current) setError(userError(reason));
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  async function enter() {
    if (!navigation?.openWorkspace) return;
    const current = generation.current;
    setBusy(true);
    setError(null);
    try {
      const { workspaceId } = await open({});
      if (current !== generation.current) return;
      onOpened(workspaceId);
      navigation.openWorkspace({ workspaceId, serverId: host.id });
    } catch (reason) {
      if (current === generation.current) setError(userError(reason));
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: theme.colors.surface0,
      }}
      contentContainerStyle={{ padding: layout.compact ? 16 : 24, gap: 12 }}
    >
      <Text
        accessibilityRole={error ? "alert" : undefined}
        style={{ color: theme.colors.foreground }}
      >
        {error ?? (setup ? "Paseo Team" : "Checking Coordinator preset…")}
      </Text>
      {setup?.status === "choose-source" && (
        <>
          <Text style={{ color: theme.colors.foreground }}>
            Choose an existing source preset. We will copy its standard runtime
            settings into a dedicated Coordinator preset and add the public
            default coordination rules to its notes. Later source edits will not
            sync.
          </Text>
          <Text style={{ color: theme.colors.foregroundMuted }}>
            This preset’s “When to use” notes will be loaded as rules for new
            Team conversations. Other presets keep their usual notes meaning.
            Notes are visible through list_profiles; keep secrets out.
            Whole-list preset updates cannot protect against simultaneous edits
            from another client.
          </Text>
          {setup.sources.length === 0 && (
            <Text style={{ color: theme.colors.foreground }}>
              Create a preset with an explicit provider and model in Settings →
              Agent profiles, then retry.
            </Text>
          )}
          {setup.sources.map((source) => (
            <Pressable
              key={source.id}
              accessibilityRole="button"
              accessibilityLabel={`Use source preset ${source.name}`}
              disabled={busy}
              onPress={() => void chooseSource(source.id)}
              style={{
                minHeight: 44,
                padding: 12,
                backgroundColor: theme.colors.surface1,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: theme.colors.foreground }}>
                {source.name}
              </Text>
              <Text style={{ color: theme.colors.foregroundMuted }}>
                {source.provider} / {source.model || "model required"}
                {source.modeId ? ` · ${source.modeId}` : ""}
              </Text>
            </Pressable>
          ))}
        </>
      )}
      {setup?.status === "ready" && (
        <>
          <Text style={{ color: theme.colors.foreground }}>
            {setup.profile
              ? `Before sending a new conversation, choose “${setup.profile.name}” in the native preset picker. Its notes are loaded as Coordinator rules once; edit them and runtime settings in Settings → Agent profiles. Existing conversations keep their saved rules.`
              : "The dedicated preset is missing. New conversations use the native configuration and the public default coordination rules. The preset will not be recreated."}
          </Text>
          <Text style={{ color: theme.colors.foregroundMuted }}>
            Paseo cannot preselect this preset through its public plugin API. A
            conflicting provider or permission mode will ask you to select it
            before sending.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Team workspace"
            disabled={busy}
            onPress={() => void enter()}
            style={{
              minHeight: 44,
              padding: 12,
              backgroundColor: theme.colors.surface1,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: theme.colors.foreground }}>
              Open Team workspace
            </Text>
          </Pressable>
        </>
      )}
      {(error || setup) && (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Bot history"
            onPress={onHistory}
            style={{ minHeight: 44, padding: 12 }}
          >
            <Text style={{ color: theme.colors.foreground }}>Bot history</Text>
          </Pressable>
          {error && navigation?.openWorkspace && (
            <WorkspaceLifecycle
              key={host.id}
              theme={theme}
              onChange={ignoreStatus}
            />
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry opening Paseo Bot"
            disabled={busy}
            onPress={() => setAttempt((value) => value + 1)}
            style={{ minHeight: 44, padding: 12 }}
          >
            <Text style={{ color: theme.colors.foreground }}>
              Retry opening Paseo Bot
            </Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}
