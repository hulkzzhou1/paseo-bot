import { useCallback, useEffect, useRef, useState } from "react";
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
  useHosts,
  useRpc,
  type PluginScreenProps,
} from "@getpaseo/plugin/client";
import { Icon, Modal } from "@getpaseo/plugin/client/ui";
import type { PaseoAgent, PaseoProviderSnapshotResult } from "@getpaseo/client";
import type { AgentTimelineItem } from "@getpaseo/protocol/agent-types";
import { bootstrap, configuration } from "../shared/contracts.ts";
import {
  submitDelivery,
  reconcileDelivery,
  type pendingDelivery,
  type deliveryOutcome,
} from "../shared/delivery.ts";
import { userError } from "../shared/user-error.ts";
import { createDeviceState } from "./device-state.ts";
import { WorkspaceLifecycle } from "./workspace-lifecycle.tsx";
import { DelegatedTargets } from "./delegated-targets.tsx";
import { HistoryMenu } from "./history.tsx";
import { ExecutionItem, RequestCard, StopControl } from "./execution.tsx";
import { observeConversation } from "./observation.ts";
import { readDeviceValue, writeDeviceValue } from "./web.ts";
import type { z } from "zod";

type PendingDelivery = z.infer<typeof pendingDelivery>;
type Outcome = z.infer<typeof deliveryOutcome>;
type Configuration = z.infer<typeof configuration>;
type Conversation = {
  id: string;
  workspaceId: string;
  config: Configuration;
  archivedAt?: string | null;
};
export function BotScreen({
  theme,
  layout,
  host,
  navigation: hostNavigation,
}: PluginScreenProps) {
  const paseo = usePaseo();
  const open = useRpc(bootstrap);
  const submit = useRpc(submitDelivery);
  const reconcile = useRpc(reconcileDelivery);
  const hosts = useHosts();
  const online = hosts.some(
    (entry) => entry.serverId === host.id && entry.status === "online",
  );
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [workspaceAccess, setWorkspaceAccess] = useState<{
    host: string;
    writable: boolean;
  } | null>(null);
  const workspaceChanged = useCallback(
    (writable: boolean) => setWorkspaceAccess({ host: host.id, writable }),
    [host.id],
  );
  const archivedConversation = useCallback((id: string, archivedAt: string) => {
    setConversations((previous) =>
      previous.map((entry) =>
        entry.id === id ? { ...entry, archivedAt } : entry,
      ),
    );
    setObservationAttempt((value) => value + 1);
  }, []);
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
  const [stopped, setStopped] = useState<{
    host: string;
    agentId: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializedHost, setInitializedHost] = useState<string | null>(null);
  const [initializationAttempt, setInitializationAttempt] = useState(0);
  const [observationAttempt, setObservationAttempt] = useState(0);
  const [observationError, setObservationError] = useState<string | null>(null);
  const messageScroll = useRef<ScrollView>(null);
  const followMessages = useRef(true);
  const lifetime = useRef(0);
  const navigation = useRef(0);
  const [observationLoading, setObservationLoading] = useState(false);
  const [deliveryView, setDeliveryView] = useState<{
    host: string;
    slot: string | null;
    record: PendingDelivery | null;
    result: Outcome;
    blocked?: boolean;
  } | null>(null);
  const busy = useRef(false);
  const currentHost = useRef(host.id);
  currentHost.current = host.id;
  const device = useRef<ReturnType<typeof createDeviceState> | null>(null);
  const selectedRef = useRef<string | null>(null);
  const input = useRef<TextInput>(null);
  const mergeHistory = useCallback((entries: Conversation[]) => {
    setConversations((previous) => [
      ...previous.filter(
        (entry) => !entries.some((next) => next.id === entry.id),
      ),
      ...entries,
    ]);
  }, []);
  const persistenceError = useCallback((reason: unknown) => {
    setError(
      `Device storage could not be saved. Keep this page open to retain edits. ${userError(reason)}`,
    );
  }, []);
  const loadDelivery = useCallback(
    (slot: string | null) => {
      setDeliveryView(null);
      try {
        const saved = device.current?.delivery(slot);
        if (saved) {
          setDeliveryView({
            host: host.id,
            slot,
            record: saved,
            result: {
              state: "unknown",
              message:
                "A previous message needs delivery verification. Check delivery before sending again.",
            },
          });
        }
      } catch (reason) {
        setDeliveryView({
          host: host.id,
          slot,
          record: null,
          result: {
            state: "unknown",
            message: `Saved delivery state could not be read. Restore device storage and reopen this page. ${userError(reason)}`,
          },
        });
      }
    },
    [host.id],
  );
  function selectConversation(id: string | null) {
    loadDelivery(id);
    selectedRef.current = id;
    setSelected(id);
    setHistory(false);
    setError(null);
    navigation.current++;
    try {
      setDraft(device.current?.draft(id).text ?? "");
    } catch (reason) {
      setDraft("");
      persistenceError(reason);
    }
    try {
      device.current?.select(id);
    } catch (reason) {
      persistenceError(reason);
    }
  }
  function editDraft(text: string) {
    setDraft(text);
    try {
      device.current?.edit(selectedRef.current, text);
    } catch (reason) {
      persistenceError(reason);
    }
  }
  const muted = { color: theme.colors.foregroundMuted };
  const normal = { color: theme.colors.foreground };
  // biome-ignore lint/correctness/useExhaustiveDependencies: explicit retry repeats bootstrap and restores saved device state.
  useEffect(() => {
    let active = true;
    const visit = ++lifetime.current;
    setDeliveryView(null);
    busy.current = false;
    navigation.current++;
    setPending(false);
    setDraft("");
    setConfig({});
    setConversations([]);
    setCatalog([]);
    setPicker(null);
    setHistory(false);
    setLoading(true);
    setInitializedHost(null);
    selectedRef.current = null;
    device.current = null;
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
      .then(async ([state, providers]) => {
        if (!active) return;
        setConversations(state.conversations);
        setCatalog(providers.entries);
        device.current = createDeviceState(
          { read: readDeviceValue, write: writeDeviceValue },
          host.id,
          state.installationId,
        );
        try {
          const remembered = device.current.selection();
          const owned = state.conversations.find(
            (entry) => entry.id === remembered,
          );
          const found = owned
            ? await paseo.agents.ref(owned.id).refresh()
            : null;
          if (!active) return;
          const id =
            found &&
            found.agent.workspaceId === owned?.workspaceId &&
            found.agent.labels["paseo-bot"] === state.installationId
              ? remembered
              : null;
          selectedRef.current = id;
          setSelected(id);
          setDraft(device.current.draft(id).text);
          device.current.select(id);
        } catch (reason) {
          if (active) persistenceError(reason);
        }
        if (!active) return;
        try {
          const stored = configuration.safeParse(
            readDeviceValue(`${host.id}:configuration`),
          );
          if (stored.success) setConfig(stored.data);
          else setConfig({});
        } catch {
          setError("Device preferences could not be read.");
        }
        loadDelivery(selectedRef.current);
        setInitializedHost(host.id);
        setLoading(false);
      })
      .catch((reason) => {
        if (active) {
          setError(userError(reason));
          setLoading(false);
        }
      });
    return () => {
      active = false;
      if (lifetime.current === visit) lifetime.current++;
    };
  }, [
    paseo,
    open,
    host.id,
    persistenceError,
    loadDelivery,
    initializationAttempt,
  ]);
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
      error: (reason) => setObservationError(userError(reason)),
      loading: setObservationLoading,
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
  function deliveryContext() {
    const sentDevice = device.current;
    const visit = lifetime.current;
    const sentHost = host.id;
    const selection = navigation.current;
    return {
      sentDevice,
      sentHost,
      selection,
      isCurrent: () =>
        currentHost.current === sentHost &&
        lifetime.current === visit &&
        device.current === sentDevice,
    };
  }
  function finishDelivery(
    record: PendingDelivery,
    result: Outcome,
    context: ReturnType<typeof deliveryContext>,
  ) {
    if (!context.isCurrent() || !context.sentDevice) return;
    const store = context.sentDevice;
    if (selectedRef.current === record.slot)
      setDeliveryView({
        host: context.sentHost,
        slot: record.slot,
        record,
        result,
      });
    if (result.state !== "accepted" && result.state !== "failed") return;
    try {
      let promoted: { conversation: Conversation; draft: string } | null = null;
      if (result.state === "accepted") {
        const conversation = result.conversation;
        if (conversation)
          setConversations((previous) => [
            ...previous.filter((entry) => entry.id !== conversation.id),
            conversation,
          ]);
        if (
          conversation &&
          record.slot === null &&
          selectedRef.current === null &&
          navigation.current === context.selection
        ) {
          promoted = {
            conversation,
            draft: store.created(conversation.id, record),
          };
        } else {
          const remaining = store.accepted(record.slot, record);
          if (selectedRef.current === record.slot) setDraft(remaining);
        }
      }
      store.setDelivery(record.slot, null);
      if (promoted) {
        const { conversation, draft } = promoted;
        setDraft(draft);
        selectedRef.current = conversation.id;
        setSelected(conversation.id);
        try {
          store.select(conversation.id);
          writeDeviceValue(
            `${context.sentHost}:configuration`,
            conversation.config,
          );
        } catch (reason) {
          persistenceError(reason);
        }
      }
    } catch (reason) {
      persistenceError(reason);
      if (selectedRef.current === record.slot)
        setDeliveryView({
          host: context.sentHost,
          slot: record.slot,
          record,
          result: {
            ...result,
            message:
              "Delivery was checked, but local cleanup could not be saved. Restore device storage and check delivery again.",
          },
          blocked: true,
        });
    }
  }
  async function checkDelivery(record: PendingDelivery) {
    const context = deliveryContext();
    setPending(true);
    busy.current = true;
    try {
      finishDelivery(
        record,
        await reconcile({ requestId: record.input.requestId }),
        context,
      );
    } catch (reason) {
      if (context.isCurrent() && selectedRef.current === record.slot)
        setDeliveryView({
          host: host.id,
          slot: record.slot,
          record,
          result: {
            state: "unknown",
            message: `Delivery is unknown. ${userError(reason)}`,
          },
        });
    } finally {
      if (context.isCurrent()) {
        setPending(false);
        busy.current = false;
      }
    }
  }
  async function dispatch(record: PendingDelivery) {
    const context = deliveryContext();
    if (!context.sentDevice) return;
    busy.current = true;
    setPending(true);
    setStopped(null);
    setError(null);
    setDeliveryView({
      host: host.id,
      slot: record.slot,
      record,
      result: {
        state: "unknown",
        message: "Sending. Keep your draft until delivery is confirmed.",
      },
    });
    try {
      context.sentDevice.setDelivery(record.slot, record);
      finishDelivery(record, await submit(record.input), context);
    } catch (reason) {
      if (context.isCurrent() && selectedRef.current === record.slot)
        setDeliveryView({
          host: host.id,
          slot: record.slot,
          record,
          result: {
            state: "unknown",
            message: `Delivery is unknown. ${userError(reason)} Check delivery before trying again.`,
          },
        });
    } finally {
      if (context.isCurrent()) {
        busy.current = false;
        setPending(false);
      }
    }
  }
  async function send() {
    if (
      !composerReady ||
      !online ||
      readOnly ||
      !workspaceWritable ||
      busy.current ||
      running ||
      waiting ||
      unavailable ||
      unresolved ||
      !draft.trim()
    )
      return;
    const parsed = configuration.safeParse(config);
    if (!selected && !parsed.success) {
      setError("Choose provider, model and permission mode before sending.");
      return;
    }
    if (!device.current) return;
    const submitted = device.current.draft(selected);
    const requestId = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      (character) => {
        const random = Math.floor(Math.random() * 16);
        return (character === "x" ? random : (random & 3) | 8).toString(16);
      },
    );
    await dispatch({
      slot: selected,
      ...submitted,
      input: {
        requestId,
        text: draft,
        ...(selected
          ? { agentId: selected }
          : { config: parsed.data as Configuration }),
      },
    });
  }

  const provider = catalog.find((entry) => entry.provider === config.provider);
  const model = provider?.models?.find((entry) => entry.id === config.model);
  const unavailable =
    selected !== null &&
    (agent === null ||
      observationError !== null ||
      observationLoading ||
      !online);
  const running =
    agent?.status === "running" ||
    agent?.status === "initializing" ||
    Boolean(agent?.activeTurn);
  const waiting = Boolean(agent?.pendingPermissions.length);
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
  const composerReady =
    !loading && initializedHost === host.id && device.current !== null;
  const currentDelivery =
    deliveryView?.host === host.id && deliveryView.slot === selected
      ? deliveryView
      : null;
  const unresolved = Boolean(
    currentDelivery &&
      (currentDelivery.blocked ||
        currentDelivery.result.state === "unknown" ||
        currentDelivery.result.state === "ready"),
  );

  const readOnly = Boolean(
    agent?.archivedAt ||
      conversations.find((entry) => entry.id === selected)?.archivedAt,
  );
  const workspaceWritable =
    workspaceAccess?.host === host.id && workspaceAccess.writable;
  const disabled =
    readOnly ||
    !workspaceWritable ||
    !composerReady ||
    !online ||
    unresolved ||
    pending ||
    running ||
    waiting ||
    unavailable ||
    !draft.trim();
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
          disabled={!composerReady}
          accessibilityState={{ disabled: !composerReady }}
          onPress={() => {
            selectConversation(null);
            input.current?.focus();
          }}
          style={{
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="Plus" size={18} color={theme.colors.foregroundMuted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="History"
          disabled={!composerReady}
          accessibilityState={{ disabled: !composerReady }}
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
      <WorkspaceLifecycle
        key={host.id}
        theme={theme}
        onChange={workspaceChanged}
      />
      {Platform.OS !== "web" && (
        <Text style={muted}>
          This Paseo version cannot persist Bot preferences or drafts on native
          devices.
        </Text>
      )}
      {history && (
        <HistoryMenu
          theme={theme}
          compact={layout.compact}
          onSelect={selectConversation}
          onClose={() => setHistory(false)}
          onEntries={mergeHistory}
          onArchived={archivedConversation}
        />
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
      {!loading &&
        initializedHost !== host.id &&
        button(
          "Retry Bot initialization",
          () => setInitializationAttempt((value) => value + 1),
          !online,
        )}
      {!online && (
        <Text
          accessibilityRole="alert"
          style={{ color: theme.colors.statusWarning, paddingVertical: 8 }}
        >
          This host is offline. Your draft is kept here; reconnect before
          sending.
        </Text>
      )}
      {currentDelivery && (
        <View style={{ gap: 8, paddingVertical: 8 }}>
          <Text
            accessibilityRole="alert"
            style={{
              color:
                currentDelivery.result.state === "failed"
                  ? theme.colors.statusDanger
                  : theme.colors.foregroundMuted,
            }}
          >
            {currentDelivery.result.message ??
              (currentDelivery.result.state === "accepted"
                ? "Message delivered."
                : "Delivery is unknown. Check before trying again.")}
          </Text>
          {unresolved && currentDelivery.record && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {button(
                pending ? "Checking delivery…" : "Check delivery",
                () => {
                  if (currentDelivery.record)
                    void checkDelivery(currentDelivery.record);
                },
                pending || !online,
              )}
              {currentDelivery.result.state === "ready" &&
                button(
                  "Retry original message",
                  () => {
                    if (currentDelivery.record)
                      void dispatch(currentDelivery.record);
                  },
                  pending ||
                    !online ||
                    readOnly ||
                    !workspaceWritable ||
                    running ||
                    waiting ||
                    unavailable,
                )}
            </View>
          )}
        </View>
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
          {items.map(({ item, seq }) => (
            <ExecutionItem
              key={`${selected}:${seq}`}
              item={item}
              streaming={running && seq === items.at(-1)?.seq}
              theme={theme}
              layout={layout}
            />
          ))}
          {selected &&
            !readOnly &&
            agent?.pendingPermissions.map((request) => (
              <RequestCard
                key={`${host.id}:${selected}:${request.id}`}
                request={request}
                agentId={selected}
                theme={theme}
                layout={layout}
                disabled={unavailable || !online || !workspaceWritable}
              />
            ))}
          {selected && (
            <DelegatedTargets
              key={`${host.id}:${selected}`}
              parentId={selected}
              timeline={items.map(({ item }) => item)}
              hostId={host.id}
              theme={theme}
              navigation={hostNavigation}
            />
          )}
        </View>
      </ScrollView>
      {readOnly && (
        <Text
          accessibilityRole="alert"
          style={{ ...muted, fontSize: 13, paddingBottom: 8 }}
        >
          Archived conversation. Read-only. Use New conversation to continue
          with context you supply yourself.
        </Text>
      )}
      {unavailable && !observationError && (
        <Text style={{ ...muted, fontSize: 13, paddingBottom: 8 }}>
          Loading conversation…
        </Text>
      )}
      {stopped?.host === host.id &&
        stopped.agentId === selected &&
        !running && (
          <Text
            accessibilityRole="alert"
            style={{ ...muted, fontSize: 13, paddingBottom: 8 }}
          >
            Stopped. You can send your draft.
          </Text>
        )}
      {waiting && !running && (
        <Text
          accessibilityRole="alert"
          style={{ ...muted, fontSize: 13, paddingBottom: 8 }}
        >
          Waiting for your response. Your draft stays editable.
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
          editable={composerReady && !readOnly}
          onChangeText={editDraft}
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
          {running && selected && !readOnly ? (
            <StopControl
              key={`${host.id}:${selected}`}
              agentId={selected}
              theme={theme}
              disabled={unavailable || !online || !workspaceWritable}
              onStopped={() => setStopped({ host: host.id, agentId: selected })}
            />
          ) : (
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
          )}
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
