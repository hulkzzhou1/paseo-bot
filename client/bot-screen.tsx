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
import {
  Icon,
  Markdown,
  Modal,
  StreamedText,
} from "@getpaseo/plugin/client/ui";
import type { PaseoAgent, PaseoProviderSnapshotResult } from "@getpaseo/client";
import type { AgentTimelineItem } from "@getpaseo/protocol/agent-types";
import {
  bootstrap,
  configuration,
  createConversation,
} from "../shared/contracts.ts";
import { observeConversation } from "./observation.ts";
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
  const [picker, setPicker] = useState<{
    title: string;
    key: keyof Configuration;
    values: { id: string; label: string }[];
  } | null>(null);
  const [agent, setAgent] = useState<PaseoAgent | null>(null);
  const [items, setItems] = useState<
    { seq: number; item: AgentTimelineItem }[]
  >([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [observationAttempt, setObservationAttempt] = useState(0);
  const [observationError, setObservationError] = useState<string | null>(null);
  const messageScroll = useRef<ScrollView>(null);
  const followMessages = useRef(true);
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
    setPicker(null);
    setHistory(false);
    setLoading(true);
    setSelected(null);
    setItems([]);
    setAgent(null);
    setError(null);
    open({})
      .then(
        async (state) =>
          [
            state,
            await paseo.providers.waitForReady({ cwd: state.directory }),
          ] as const,
      )
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: explicit retry replaces a released SDK observation.
  useEffect(() => {
    setItems([]);
    setAgent(null);
    setObservationError(null);
    followMessages.current = true;
    if (!selected) return;
    return observeConversation(paseo.agents.ref(selected), {
      timeline: (page) =>
        setItems(
          page.entries.map((entry) => ({
            seq: entry.seqStart,
            item: entry.item,
          })),
        ),
      agent: setAgent,
      error: (reason) => setObservationError(String(reason)),
    });
  }, [paseo, selected, observationAttempt]);
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
    const label =
      values.find((value) => value.id === config[key])?.label ?? title;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${label}`}
        onPress={() => setPicker({ title, key, values })}
        style={{
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingHorizontal: 6,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            ...muted,
            fontSize: 13,
            maxWidth: layout.compact ? 150 : 220,
          }}
        >
          {label}
        </Text>
        <Icon
          name="ChevronDown"
          size={12}
          color={theme.colors.foregroundMuted}
        />
      </Pressable>
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
  const unavailable =
    selected !== null && (agent === null || observationError !== null);
  const running =
    agent?.status === "running" ||
    agent?.status === "initializing" ||
    Boolean(agent?.activeTurn);
  const activeConfig = selected
    ? conversations.find((conversation) => conversation.id === selected)?.config
    : config;
  const activeProvider = catalog.find(
    (entry) => entry.provider === activeConfig?.provider,
  );
  const activeModel = activeProvider?.models?.find(
    (entry) => entry.id === activeConfig?.model,
  );
  const activeThinking = activeModel?.thinkingOptions?.find(
    (option) => option.id === activeConfig?.thinkingOptionId,
  );
  const activeMode = activeProvider?.modes?.find(
    (mode) => mode.id === activeConfig?.modeId,
  );
  const disabled =
    loading || pending || running || unavailable || !draft.trim();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{
        flex: 1,
        backgroundColor: theme.colors.surface0,
        paddingHorizontal: 16,
        paddingBottom: 16,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          minHeight: 44,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{ ...normal, fontSize: 14, fontWeight: "600", flex: 1 }}
        >
          Paseo Bot
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New conversation"
          accessibilityState={{ disabled: pending }}
          disabled={pending}
          onPress={() => {
            setSelected(null);
            setHistory(false);
            setError(null);
            request.current = null;
            input.current?.focus();
          }}
          style={{
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
            opacity: pending ? 0.5 : 1,
          }}
        >
          <Icon name="Plus" size={18} color={theme.colors.foregroundMuted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="History"
          onPress={() => setHistory((value) => !value)}
          style={{
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="History" size={18} color={theme.colors.foregroundMuted} />
        </Pressable>
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
        <Text
          accessibilityRole="alert"
          style={{ color: theme.colors.statusDanger, paddingVertical: 8 }}
        >
          {error}
        </Text>
      )}
      {observationError && (
        <View style={{ gap: 8, paddingVertical: 8 }}>
          <Text
            accessibilityRole="alert"
            style={{ color: theme.colors.statusDanger }}
          >
            Live updates stopped. {observationError}
          </Text>
          {button("Retry live updates", () =>
            setObservationAttempt((attempt) => attempt + 1),
          )}
        </View>
      )}
      <ScrollView
        ref={messageScroll}
        testID="bot-messages"
        scrollEventThrottle={16}
        onScroll={({ nativeEvent }) => {
          followMessages.current =
            nativeEvent.contentOffset.y +
              nativeEvent.layoutMeasurement.height >=
            nativeEvent.contentSize.height - 64;
        }}
        onContentSizeChange={() => {
          if (followMessages.current)
            messageScroll.current?.scrollToEnd({ animated: false });
        }}
        onLayout={() => {
          if (followMessages.current)
            messageScroll.current?.scrollToEnd({ animated: false });
        }}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: layout.compact ? 16 : 32,
          paddingBottom: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            width: "100%",
            maxWidth: 820,
            alignSelf: "center",
            paddingHorizontal: layout.compact ? 0 : 8,
            gap: 24,
          }}
        >
          {!selected && !loading && (
            <View style={{ paddingVertical: 32, gap: 8 }}>
              <Text style={{ ...normal, fontSize: 22, fontWeight: "600" }}>
                What would you like to do?
              </Text>
              <Text style={{ ...muted, fontSize: 14, lineHeight: 20 }}>
                Start a conversation on {host.label}. Choose the configuration
                below before sending.
              </Text>
              <Text style={{ ...muted, fontSize: 13, lineHeight: 19 }}>
                Bot conversations share files in their host workspace; each has
                its own chat context.
              </Text>
            </View>
          )}
          {items.map(({ item, seq }) =>
            item.type === "user_message" ? (
              <View
                key={`${selected}:${seq}`}
                style={{
                  alignSelf: "flex-end",
                  maxWidth: "100%",
                  backgroundColor: theme.colors.surface2,
                  borderRadius: 20,
                  borderTopRightRadius: 3,
                  padding: 16,
                }}
              >
                <Text
                  selectable
                  style={{ ...normal, fontSize: 16, lineHeight: 22 }}
                >
                  {item.text}
                </Text>
              </View>
            ) : item.type === "assistant_message" ? (
              <View key={`${selected}:${seq}`} style={{ width: "100%" }}>
                {running && seq === items.at(-1)?.seq ? (
                  <StreamedText
                    text={item.text}
                    phase="streaming"
                    style={{ ...normal, fontSize: 16, lineHeight: 22 }}
                  />
                ) : (
                  <Markdown>{item.text}</Markdown>
                )}
              </View>
            ) : item.type === "error" ? (
              <Text
                key={`${selected}:${seq}`}
                style={{ color: theme.colors.statusDanger }}
              >
                {item.message}
              </Text>
            ) : null,
          )}
        </View>
      </ScrollView>
      {unavailable && !observationError && (
        <Text style={{ ...muted, fontSize: 13, paddingBottom: 8 }}>
          Loading conversation…
        </Text>
      )}
      {running && (
        <Text
          accessibilityRole="alert"
          style={{ ...muted, fontSize: 13, paddingBottom: 8 }}
        >
          Running. You can edit a draft while this turn finishes.
        </Text>
      )}
      <View
        style={{
          width: "100%",
          maxWidth: 820,
          alignSelf: "center",
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: 18,
          backgroundColor: theme.colors.surface1,
          padding: 8,
          gap: 4,
        }}
      >
        <TextInput
          ref={input}
          accessibilityLabel="Message Paseo Bot"
          value={draft}
          onChangeText={setDraft}
          multiline
          placeholder="Message Paseo Bot…"
          placeholderTextColor={theme.colors.foregroundMuted}
          style={{
            ...normal,
            fontSize: 16,
            lineHeight: 22,
            minHeight: 60,
            maxHeight: 180,
            paddingHorizontal: 8,
            paddingTop: 8,
            paddingBottom: 8,
          }}
        />
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 4,
          }}
        >
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 0,
            }}
          >
            {selected ? (
              <Text
                numberOfLines={1}
                style={{
                  ...muted,
                  fontSize: 13,
                  paddingHorizontal: 8,
                  paddingVertical: 12,
                  flexShrink: 1,
                }}
              >
                {[
                  activeModel?.label ?? activeConfig?.model,
                  activeThinking?.label,
                  activeMode?.label,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            ) : (
              <>
                {options(
                  "Provider",
                  catalog
                    .filter(
                      (entry) => entry.enabled && entry.status === "ready",
                    )
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
                  ? options(
                      "Thinking",
                      model.thinkingOptions,
                      "thinkingOptionId",
                    )
                  : null}
                {provider &&
                  options("Permission mode", provider.modes ?? [], "modeId")}
              </>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={pending ? "Sending…" : "Send"}
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() => void send()}
            style={{
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
              opacity: disabled ? 0.45 : 1,
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: theme.colors.foreground,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon
                name={pending ? "LoaderCircle" : "ArrowUp"}
                size={18}
                color={theme.colors.surface0}
              />
            </View>
          </Pressable>
        </View>
      </View>
      <Modal
        open={picker !== null}
        title={
          picker ? `Choose ${picker.title.toLowerCase()}` : "Configuration"
        }
        onOpenChange={(open) => {
          if (!open) setPicker(null);
        }}
      >
        <Modal.Content contentContainerStyle={{ padding: 12, gap: 4 }}>
          {picker?.values.map((value) => (
            <Pressable
              key={value.id}
              accessibilityRole="button"
              accessibilityLabel={value.label}
              accessibilityState={{ selected: config[picker.key] === value.id }}
              onPress={() => {
                choose(picker.key, value.id);
                setPicker(null);
              }}
              style={{
                minHeight: 44,
                paddingHorizontal: 12,
                paddingVertical: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                borderRadius: 8,
                backgroundColor:
                  config[picker.key] === value.id
                    ? theme.colors.surface2
                    : theme.colors.surface0,
              }}
            >
              <Text style={{ ...normal, fontSize: 14, flex: 1 }}>
                {value.label}
              </Text>
              {config[picker.key] === value.id && (
                <Icon name="Check" size={16} color={theme.colors.foreground} />
              )}
            </Pressable>
          ))}
        </Modal.Content>
      </Modal>
    </KeyboardAvoidingView>
  );
}
