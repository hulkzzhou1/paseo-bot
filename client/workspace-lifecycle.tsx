import { userError } from "../shared/user-error.ts";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRpc, type PluginScreenProps } from "@getpaseo/plugin/client";
import { inspectWorkspace, rebuildWorkspace } from "../shared/lifecycle.ts";
import type { RpcOutput } from "@getpaseo/plugin";
export function WorkspaceLifecycle({
  theme,
  onChange,
}: {
  theme: PluginScreenProps["theme"];
  onChange(writable: boolean): void;
}) {
  const inspect = useRpc(inspectWorkspace),
    rebuild = useRpc(rebuildWorkspace);
  const [status, setStatus] = useState<RpcOutput<
    typeof inspectWorkspace
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const epoch = useRef(0),
    mounted = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: explicit retry refreshes status after a failed inspection.
  useEffect(() => {
    let active = true,
      reading = false;
    mounted.current = true;
    async function refresh() {
      if (reading) return;
      reading = true;
      const version = epoch.current;
      try {
        const next = await inspect({});
        if (active && version === epoch.current) {
          setStatus(next);
          setError(null);
          onChange(next.state === "none" || next.state === "ready");
        }
      } catch (reason) {
        if (active && version === epoch.current) {
          setStatus(null);
          setError(
            `Workspace status is unknown. Check the connection and retry. ${userError(reason)}`,
          );
          onChange(false);
        }
      } finally {
        reading = false;
      }
    }
    void refresh();
    const interval = setInterval(() => void refresh(), 3000);
    return () => {
      active = false;
      mounted.current = false;
      clearInterval(interval);
    };
  }, [inspect, onChange, attempt]);
  async function recreate() {
    if (
      pending ||
      !status?.workspaceId ||
      !["archived", "unavailable"].includes(status.state)
    )
      return;
    epoch.current++;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      await rebuild({ expectedWorkspaceId: status.workspaceId });
      const next = await inspect({});
      if (mounted.current) {
        setStatus(next);
        onChange(next.state === "ready");
        setNotice(
          "Bot workspace rebuilt. Existing history and shared files are preserved.",
        );
      }
    } catch (reason) {
      if (mounted.current) setError(userError(reason));
    } finally {
      if (mounted.current) setPending(false);
    }
  }
  const blocked =
    status?.state === "archived" || status?.state === "unavailable";
  if (!blocked && !error && !notice && !pending) return null;
  function action(label: string, fn: () => void, disabled = false) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        accessibilityState={{ disabled }}
        onPress={fn}
        style={{
          minHeight: 44,
          padding: 12,
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: 8,
          alignSelf: "flex-start",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Text style={{ color: theme.colors.foreground }}>{label}</Text>
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
      {blocked && (
        <Text
          accessibilityRole="alert"
          style={{ color: theme.colors.foreground }}
        >
          {status.state === "archived"
            ? "The Bot workspace was archived."
            : "The Bot workspace is archived or no longer available."}{" "}
          New Bot conversations are blocked. Rebuild explicitly to create a new
          background workspace; old history and shared files remain.
        </Text>
      )}
      {notice && (
        <Text
          accessibilityRole="alert"
          style={{ color: theme.colors.foregroundMuted }}
        >
          {notice}
        </Text>
      )}
      {error && (
        <Text
          accessibilityRole="alert"
          style={{ color: theme.colors.statusDanger }}
        >
          {error}
        </Text>
      )}
      {blocked &&
        action(
          pending ? "Rebuilding Bot workspace…" : "Rebuild Bot workspace",
          () => void recreate(),
          pending,
        )}
      {error &&
        action(
          "Retry workspace status",
          () => setAttempt((value) => value + 1),
          pending,
        )}
    </View>
  );
}
