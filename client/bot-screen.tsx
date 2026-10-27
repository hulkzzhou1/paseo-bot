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
import type { PaseoProviderSnapshotResult } from "@getpaseo/client";
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
import { HistoryMenu } from "./history.tsx";
import { readDeviceValue, writeDeviceValue } from "./web.ts";
import type { z } from "zod";

type PendingDelivery = z.infer<typeof pendingDelivery>;
type Outcome = z.infer<typeof deliveryOutcome>;
type Configuration = z.infer<typeof configuration>;
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
  const [workspaceAccess, setWorkspaceAccess] = useState<{
    host: string;
    writable: boolean;
  } | null>(null);
  const workspaceChanged = useCallback(
    (writable: boolean) => setWorkspaceAccess({ host: host.id, writable }),
    [host.id],
  );
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
  const [pending, setPending] = useState(false);
  const [createdConversation, setCreatedConversation] = useState<{
    host: string;
    id: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializedHost, setInitializedHost] = useState<string | null>(null);
  const [initializationAttempt, setInitializationAttempt] = useState(0);
  const openedDelivery = useRef<string | null>(null);
  const lifetime = useRef(0);
  const navigation = useRef(0);
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
  const input = useRef<TextInput>(null);
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
  function openNative(id: string) {
    if (!hostNavigation?.openAgent) {
      setError(
        "Native chat navigation is unavailable. Update or reopen Paseo before sending.",
      );
      return;
    }
    try {
      hostNavigation.openAgent({ agentId: id, serverId: host.id });
    } catch (reason) {
      setError(`Could not open native chat. ${userError(reason)}`);
    }
  }
  function openHistory(id: string) {
    navigation.current++;
    setHistory(false);
    openNative(id);
  }
  function editDraft(text: string) {
    setDraft(text);
    try {
      device.current?.edit(null, text);
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
    setCreatedConversation(null);
    busy.current = false;
    navigation.current++;
    setPending(false);
    setDraft("");
    setConfig({});
    setCatalog([]);
    setPicker(null);
    setHistory(false);
    setLoading(true);
    setInitializedHost(null);
    device.current = null;
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
        setCatalog(providers.entries);
        device.current = createDeviceState(
          { read: readDeviceValue, write: writeDeviceValue },
          host.id,
          state.installationId,
        );
        try {
          // Returning from native chat must leave the Bot entrance accessible.
          setDraft(device.current.draft(null).text);
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
        loadDelivery(null);
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
    setDeliveryView({ host: context.sentHost, slot: null, record, result });
    if (result.state !== "accepted" && result.state !== "failed") return;
    try {
      if (result.state === "accepted") setDraft(store.accepted(null, record));
      store.setDelivery(null, null);
    } catch (reason) {
      persistenceError(reason);
      setDeliveryView({
        host: context.sentHost,
        slot: null,
        record,
        result: {
          ...result,
          message:
            "Delivery was checked, but local cleanup could not be saved. Restore device storage and check delivery again.",
        },
        blocked: true,
      });
      return;
    }
    if (result.state === "accepted" && result.conversation) {
      setCreatedConversation({
        host: context.sentHost,
        id: result.conversation.id,
      });
      try {
        writeDeviceValue(
          `${context.sentHost}:configuration`,
          result.conversation.config,
        );
      } catch (reason) {
        persistenceError(reason);
      }
      if (
        navigation.current === context.selection &&
        openedDelivery.current !== record.input.requestId
      ) {
        openedDelivery.current = record.input.requestId;
        openNative(result.conversation.id);
      }
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
      if (context.isCurrent())
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
      if (context.isCurrent())
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
      !hostNavigation?.openAgent ||
      !online ||
      !workspaceWritable ||
      busy.current ||
      unresolved ||
      !draft.trim()
    )
      return;
    const parsed = configuration.safeParse(config);
    if (!parsed.success) {
      setError("Choose provider, model and permission mode before sending.");
      return;
    }
    if (!device.current) return;
    const submitted = device.current.draft(null);
    const requestId = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      (character) => {
        const random = Math.floor(Math.random() * 16);
        return (character === "x" ? random : (random & 3) | 8).toString(16);
      },
    );
    await dispatch({
      slot: null,
      ...submitted,
      input: {
        requestId,
        text: draft,
        config: parsed.data,
      },
    });
  }

  const provider = catalog.find((entry) => entry.provider === config.provider);
  const model = provider?.models?.find((entry) => entry.id === config.model);
  const composerReady =
    !loading && initializedHost === host.id && device.current !== null;
  const currentDelivery = deliveryView?.host === host.id ? deliveryView : null;
  const unresolved = Boolean(
    currentDelivery &&
      (currentDelivery.blocked ||
        currentDelivery.result.state === "unknown" ||
        currentDelivery.result.state === "ready"),
  );

  const workspaceWritable =
    workspaceAccess?.host === host.id && workspaceAccess.writable;
  const disabled =
    !hostNavigation?.openAgent ||
    !workspaceWritable ||
    !composerReady ||
    !online ||
    unresolved ||
    pending ||
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
            navigation.current++;
            setHistory(false);
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
          onSelect={openHistory}
          onClose={() => setHistory(false)}
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
                    !hostNavigation?.openAgent ||
                    !online ||
                    !workspaceWritable,
                )}
            </View>
          )}
        </View>
      )}
      {createdConversation?.host === host.id &&
        button(
          "Open created conversation",
          () => openNative(createdConversation.id),
          !hostNavigation?.openAgent,
        )}
      {!hostNavigation?.openAgent && (
        <Text
          accessibilityRole="alert"
          style={{ color: theme.colors.statusDanger }}
        >
          Native chat navigation is unavailable. Update or reopen Paseo before
          sending.
        </Text>
      )}
      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
        <View
          style={{
            width: "100%",
            maxWidth: 820,
            alignSelf: "center",
            paddingVertical: 32,
            gap: 12,
          }}
        >
          <Text style={{ ...normal, fontSize: 22, fontWeight: "600" }}>
            What would you like to do?
          </Text>
          <Text style={{ ...muted, fontSize: 14, lineHeight: 20 }}>
            Start a conversation on {host.label}. Choose the configuration
            below; after the first message, native chat opens.
          </Text>
          <Text style={muted}>
            Bot conversations share files in their host workspace; each has its
            own chat context.
          </Text>
        </View>
      </ScrollView>
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
          editable={composerReady}
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
