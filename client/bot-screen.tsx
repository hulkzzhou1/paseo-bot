import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  usePaseo,
  useRpc,
  type PluginScreenProps,
} from "@getpaseo/plugin/client";
import { Markdown, StreamedText } from "@getpaseo/plugin/client/ui";
import type { PaseoAgent, PaseoProviderSnapshotResult } from "@getpaseo/client";
import type { AgentTimelineItem } from "@getpaseo/protocol/agent-types";
import {
  bootstrap,
  configuration,
  createConversation,
} from "../shared/contracts.ts";
import { readDeviceValue, writeDeviceValue } from "./web.ts";
import type { z } from "zod";

type Configuration = z.infer<typeof configuration>;
type Conversation = { id: string; workspaceId: string; config: Configuration };
export function BotScreen({ theme, layout, host }: PluginScreenProps) {
  const paseo = usePaseo();
  const open = useRpc(bootstrap);
  const create = useRpc(createConversation);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [config, setConfig] = useState<Partial<Configuration>>({});
  const [catalog, setCatalog] = useState<
    PaseoProviderSnapshotResult["entries"]
  >([]);
  const [draft, setDraft] = useState("");
  const [history, setHistory] = useState(false);
  const [agent, setAgent] = useState<PaseoAgent | null>(null);
  const [items, setItems] = useState<
    { seq: number; item: AgentTimelineItem }[]
  >([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const request = useRef<string | null>(null);
  const busy = useRef(false);
  const currentHost = useRef(host.id);
  currentHost.current = host.id;
  const input = useRef<TextInput>(null);
  const muted = { color: theme.colors.foregroundMuted };
  const normal = { color: theme.colors.foreground };
  useEffect(() => {
    let active = true;
    busy.current = false;
    request.current = null;
    setPending(false);
    setDraft("");
    setConfig({});
    setConversations([]);
    setCatalog([]);
    setLoading(true);
    setSelected(null);
    setItems([]);
    setAgent(null);
    setError(null);
    Promise.all([open({}), paseo.providers.waitForReady()])
      .then(([state, providers]) => {
        if (!active) return;
        setConversations(state.conversations);
        setCatalog(providers.entries);
        try {
          const stored = configuration.safeParse(
            readDeviceValue(`${host.id}:configuration`),
          );
          if (stored.success) setConfig(stored.data);
          else setConfig({});
        } catch {
          setError("Device preferences could not be read.");
        }
        setLoading(false);
      })
      .catch((reason) => {
        if (active) {
          setError(String(reason));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [paseo, open, host.id]);
  useEffect(() => {
    setItems([]);
    setAgent(null);
    if (!selected) return;
    let active = true;
    const handle = paseo.agents.ref(selected);
    let reading = false,
      again = false;
    async function refresh() {
      if (reading) {
        again = true;
        return;
      }
      reading = true;
      try {
        const page = await handle.timeline.refetch({ limit: 200 });
        if (page.error) throw new Error(page.error);
        if (active) {
          setItems(
            page.entries.map((entry) => ({
              seq: entry.seqStart,
              item: entry.item,
            })),
          );
          setAgent(handle.current());
        }
      } catch (reason) {
        if (active) setError(String(reason));
      } finally {
        reading = false;
        if (again && active) {
          again = false;
          void refresh();
        }
      }
    }
    const unsubscribe = handle.timeline.subscribe(() => void refresh());
    const updates = handle.subscribe(() => {
      if (active) setAgent(handle.current());
    });
    void unsubscribe.ready.then(refresh).catch((reason) => {
      if (active) setError(String(reason));
    });
    return () => {
      active = false;
      unsubscribe();
      updates();
    };
  }, [paseo, selected]);
  function button(title: string, onPress: () => void, disabled = false) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={{
          padding: 12,
          minHeight: 44,
          borderRadius: 8,
          backgroundColor: theme.colors.surface1,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Text style={normal}>{title}</Text>
      </Pressable>
    );
  }
  function choose(key: keyof Configuration, value: string) {
    setConfig((previous) =>
      key === "provider"
        ? { provider: value }
        : key === "model"
          ? { ...previous, model: value, thinkingOptionId: undefined }
          : { ...previous, [key]: value },
    );
  }
  function options(
    title: string,
    values: { id: string; label: string }[],
    key: keyof Configuration,
  ) {
    return (
      <View style={{ gap: 6 }}>
        <Text style={muted}>{title}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {values.map((value) => (
            <View key={value.id}>
              {button(
                `${config[key] === value.id ? "✓ " : ""}${value.label}`,
                () => choose(key, value.id),
              )}
            </View>
          ))}
        </View>
      </View>
    );
  }
  async function send() {
    if (busy.current || running || unavailable || !draft.trim()) return;
    const parsed = configuration.safeParse(config);
    if (!selected && !parsed.success) {
      setError("Choose provider, model and permission mode before sending.");
      return;
    }
    busy.current = true;
    setPending(true);
    setError(null);
    const submitted = draft;
    const sentHost = host.id;
    try {
      if (selected) {
        await paseo.agents.ref(selected).send(submitted);
      } else {
        request.current ??= "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
          /[xy]/g,
          (character) => {
            const random = Math.floor(Math.random() * 16);
            return (character === "x" ? random : (random & 3) | 8).toString(16);
          },
        );
        const conversation = await create({
          requestId: request.current,
          text: submitted,
          config: parsed.data as Configuration,
        });
        if (currentHost.current !== sentHost) return;
        setConversations((previous) => [
          ...previous.filter((entry) => entry.id !== conversation.id),
          conversation,
        ]);
        setSelected(conversation.id);
        request.current = null;
        try {
          writeDeviceValue(`${host.id}:configuration`, conversation.config);
        } catch {
          setError(
            "Message accepted, but device preferences could not be saved.",
          );
        }
      }
      if (currentHost.current === sentHost)
        setDraft((current) => (current === submitted ? "" : current));
    } catch (reason) {
      if (currentHost.current === sentHost) setError(String(reason));
    } finally {
      if (currentHost.current === sentHost) {
        busy.current = false;
        setPending(false);
      }
    }
  }
  const provider = catalog.find((entry) => entry.provider === config.provider);
  const model = provider?.models?.find((entry) => entry.id === config.model);
  const unavailable = selected !== null && agent === null;
  const running =
    agent?.status === "running" ||
    agent?.status === "initializing" ||
    Boolean(agent?.activeTurn);
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{
        flex: 1,
        backgroundColor: theme.colors.surface0,
        padding: layout.compact ? 12 : 24,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text
          accessibilityRole="header"
          style={{ ...normal, fontSize: 22, flex: 1 }}
        >
          Paseo Bot
        </Text>
        {button(
          "New conversation",
          () => {
            setSelected(null);
            setHistory(false);
            setError(null);
            request.current = null;
            input.current?.focus();
          },
          pending,
        )}
        {button("History", () => setHistory((value) => !value))}
      </View>
      {Platform.OS !== "web" && (
        <Text style={muted}>
          This Paseo version cannot persist Bot preferences or drafts on native
          devices.
        </Text>
      )}
      {history && (
        <ScrollView style={{ maxHeight: 180 }}>
          {conversations.map((conversation) => (
            <View key={conversation.id}>
              {button(conversation.id, () => {
                setSelected(conversation.id);
                setHistory(false);
              })}
            </View>
          ))}
          {conversations.length === 0 && (
            <Text style={muted}>No Bot conversations yet.</Text>
          )}
        </ScrollView>
      )}
      {loading && (
        <Text accessibilityRole="alert" style={muted}>
          Loading Bot…
        </Text>
      )}
      {error && (
        <Text accessibilityRole="alert" style={normal}>
          {error}
        </Text>
      )}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {!selected && !loading && (
          <View style={{ gap: 14 }}>
            <Text style={muted}>
              Start a conversation on {host.label}. Conversations share files on
              this host; their chat context stays separate.
            </Text>
            {options(
              "Provider",
              catalog
                .filter((entry) => entry.enabled && entry.status === "ready")
                .map((entry) => ({
                  id: entry.provider,
                  label: entry.label ?? entry.provider,
                })),
              "provider",
            )}
            {provider &&
              options(
                "Model",
                provider.models?.filter(
                  (model) => model.isSelectable !== false,
                ) ?? [],
                "model",
              )}
            {model?.thinkingOptions?.length
              ? options("Thinking", model.thinkingOptions, "thinkingOptionId")
              : null}
            {provider &&
              options("Permission mode", provider.modes ?? [], "modeId")}
          </View>
        )}
        {items.map(({ item, seq }) => (
          <View key={`${selected}:${seq}`} style={{ gap: 4 }}>
            {item.type === "user_message" ? (
              <>
                <Text style={muted}>You</Text>
                <Text selectable style={normal}>
                  {item.text}
                </Text>
              </>
            ) : item.type === "assistant_message" ? (
              <>
                <Text style={muted}>Bot</Text>
                {running ? (
                  <StreamedText
                    text={item.text}
                    phase="streaming"
                    style={normal}
                  />
                ) : (
                  <Markdown>{item.text}</Markdown>
                )}
              </>
            ) : item.type === "error" ? (
              <Text style={normal}>{item.message}</Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
      {unavailable && <Text style={muted}>Loading conversation…</Text>}
      {running && (
        <Text accessibilityRole="alert" style={muted}>
          Running. You can edit a draft; sending is available when this turn
          finishes.
        </Text>
      )}
      <TextInput
        ref={input}
        accessibilityLabel="Message Paseo Bot"
        value={draft}
        onChangeText={setDraft}
        multiline
        placeholder="Ask Paseo Bot…"
        placeholderTextColor={theme.colors.foregroundMuted}
        style={{
          ...normal,
          minHeight: 72,
          maxHeight: 180,
          padding: 12,
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: 8,
        }}
      />
      {button(
        pending ? "Sending…" : "Send",
        () => void send(),
        loading || pending || running || unavailable || !draft.trim(),
      )}
    </KeyboardAvoidingView>
  );
}
