import { userError } from "../shared/user-error.ts";
import { useState } from "react";
import { buildQuestionAnswers } from "./question-answers.ts";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRpc, type PluginScreenProps } from "@getpaseo/plugin/client";
import {
  Icon,
  Markdown,
  Modal,
  StreamedText,
} from "@getpaseo/plugin/client/ui";
import type {
  AgentTimelineItem,
  AgentPermissionRequest,
  ToolCallDetail,
} from "@getpaseo/protocol/agent-types";
import {
  questionsSchema,
  respondConversation,
  stopConversation,
} from "../shared/execution.ts";
type Appearance = Pick<PluginScreenProps, "theme" | "layout">;
const readable = (value: unknown) =>
  typeof value === "string" ? value : (JSON.stringify(value, null, 2) ?? "");

export function StopControl({
  agentId,
  theme,
  disabled,
  onStopped,
}: Pick<Appearance, "theme"> & {
  agentId: string;
  disabled: boolean;
  onStopped(): void;
}) {
  const stop = useRpc(stopConversation);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    if (pending || disabled) return;
    setPending(true);
    setError(null);
    try {
      await stop({ agentId });
      onStopped();
    } catch (reason) {
      setError(userError(reason));
    } finally {
      setPending(false);
    }
  }
  return (
    <View style={{ alignItems: "flex-end", flexShrink: 1 }}>
      {error && (
        <Text
          accessibilityRole="alert"
          style={{
            color: theme.colors.statusDanger,
            fontSize: 12,
            maxWidth: 240,
          }}
        >
          {error}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={pending ? "Stopping" : "Stop current conversation"}
        accessibilityState={{ disabled: pending || disabled }}
        disabled={pending || disabled}
        onPress={() => void submit()}
        style={{
          width: 44,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
          opacity: pending || disabled ? 0.5 : 1,
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: theme.colors.statusDanger,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {pending ? (
            <ActivityIndicator
              size="small"
              color={theme.colors.accentForeground}
            />
          ) : (
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 1,
                backgroundColor: theme.colors.accentForeground,
              }}
            />
          )}
        </View>
      </Pressable>
    </View>
  );
}

function Detail({
  detail,
  theme,
}: { detail: ToolCallDetail } & Pick<Appearance, "theme">) {
  return (
    <View style={{ gap: 8 }}>
      {Object.entries(detail)
        .filter(
          ([key, value]) =>
            key !== "type" &&
            value !== undefined &&
            value !== null &&
            value !== "",
        )
        .map(([key, value]) => (
          <View key={key} style={{ gap: 4 }}>
            <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>
              {key}
            </Text>
            {detail.type === "plan" && key === "text" ? (
              <Markdown>{String(value)}</Markdown>
            ) : (
              <Text
                selectable
                style={{
                  color: theme.colors.foreground,
                  fontSize: 12,
                  lineHeight: 18,
                }}
              >
                {readable(value)}
              </Text>
            )}
          </View>
        ))}
    </View>
  );
}

export function ExecutionItem({
  item,
  streaming,
  theme,
  layout,
}: Appearance & { item: AgentTimelineItem; streaming: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const normal = { color: theme.colors.foreground };
  if (item.type === "user_message")
    return (
      <View
        style={{
          alignSelf: "flex-end",
          maxWidth: "100%",
          backgroundColor: theme.colors.surface2,
          borderRadius: 20,
          borderTopRightRadius: 3,
          padding: 16,
        }}
      >
        <Text selectable style={{ ...normal, fontSize: 16, lineHeight: 22 }}>
          {item.text}
        </Text>
      </View>
    );
  if (item.type === "assistant_message")
    return (
      <View style={{ width: "100%" }}>
        {streaming ? (
          <StreamedText
            text={item.text}
            phase="streaming"
            style={{ ...normal, fontSize: 16, lineHeight: 22 }}
          />
        ) : (
          <Markdown>{item.text}</Markdown>
        )}
      </View>
    );
  if (item.type === "error")
    return (
      <Text
        accessibilityRole="alert"
        style={{ color: theme.colors.statusDanger }}
      >
        {item.message}
      </Text>
    );
  if (item.type !== "tool_call") return null;
  const detail = item.detail;
  const summary =
    "command" in detail
      ? detail.command
      : "filePath" in detail
        ? detail.filePath
        : "query" in detail
          ? detail.query
          : "url" in detail
            ? detail.url
            : "description" in detail
              ? detail.description
              : "label" in detail
                ? detail.label
                : "";
  const color =
    item.status === "failed"
      ? theme.colors.statusDanger
      : theme.colors.foregroundMuted;
  const body = (
    <View style={{ gap: 8 }}>
      <Text style={{ color, fontSize: 12 }}>{item.status}</Text>
      <Detail detail={detail} theme={theme} />
      {item.error !== null && (
        <Text selectable style={{ color: theme.colors.statusDanger }}>
          {readable(item.error)}
        </Text>
      )}
    </View>
  );
  return (
    <View style={{ gap: 4 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.name}: ${item.status}${summary ? ` · ${summary}` : ""}`}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(!expanded)}
        style={{
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 8,
        }}
      >
        {item.status === "running" ? (
          <ActivityIndicator size="small" color={color} />
        ) : (
          <Icon
            name={
              item.status === "failed"
                ? "TriangleAlert"
                : detail.type === "shell"
                  ? "Terminal"
                  : "Wrench"
            }
            size={14}
            color={color}
          />
        )}
        <Text style={{ color, fontSize: 14 }}>{item.name}</Text>
        <Text
          numberOfLines={1}
          style={{ color: theme.colors.foregroundMuted, fontSize: 13, flex: 1 }}
        >
          {summary}
        </Text>
        <Icon
          name={expanded ? "ChevronDown" : "ChevronRight"}
          size={12}
          color={color}
        />
      </Pressable>
      {expanded && !layout.compact && (
        <ScrollView
          style={{
            maxHeight: 400,
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: 8,
            backgroundColor: theme.colors.surface1,
          }}
          contentContainerStyle={{ padding: 12 }}
        >
          {body}
        </ScrollView>
      )}
      <Modal
        open={expanded && layout.compact}
        title={item.name}
        onOpenChange={setExpanded}
      >
        <Modal.Content>{body}</Modal.Content>
      </Modal>
    </View>
  );
}

export function RequestCard({
  request,
  agentId,
  theme,
  layout,
  disabled,
}: Appearance & {
  request: AgentPermissionRequest;
  agentId: string;
  disabled: boolean;
}) {
  const respond = useRpc(respondConversation);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [custom, setCustom] = useState<Record<string, string>>({});
  const parsed = questionsSchema.safeParse(request.input);
  const questions =
    request.kind === "question" && parsed.success ? parsed.data.questions : [];
  const payload = buildQuestionAnswers(questions, answers, custom);
  const ready =
    questions.length > 0 &&
    questions.every(
      (question) => question.allowEmpty || payload[question.header],
    );
  async function submit(behavior: "allow" | "deny", actionId?: string) {
    if (pending || disabled) return;
    setPending(true);
    setError(null);
    try {
      await respond({
        agentId,
        requestId: request.id,
        behavior,
        actionId,
        ...(request.kind === "question" && behavior === "allow"
          ? { answers: payload }
          : {}),
      });
    } catch (reason) {
      setError(userError(reason));
      setPending(false);
    }
  }
  function action(
    label: string,
    behavior: "allow" | "deny",
    actionId?: string,
    primary = false,
    blocked = false,
  ) {
    return (
      <Pressable
        key={actionId ?? label}
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={pending || disabled || blocked}
        accessibilityState={{ disabled: pending || disabled || blocked }}
        onPress={() => void submit(behavior, actionId)}
        style={{
          minHeight: 44,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: 6,
          backgroundColor: primary
            ? theme.colors.accent
            : theme.colors.surface1,
          opacity: pending || disabled || blocked ? 0.5 : 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        {pending ? (
          <ActivityIndicator
            size="small"
            color={
              primary
                ? theme.colors.accentForeground
                : theme.colors.foregroundMuted
            }
          />
        ) : (
          <Icon
            name={behavior === "allow" ? "Check" : "X"}
            size={14}
            color={
              primary
                ? theme.colors.accentForeground
                : theme.colors.foregroundMuted
            }
          />
        )}
        <Text
          style={{
            color: primary
              ? theme.colors.accentForeground
              : theme.colors.foreground,
            fontSize: 14,
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  }
  return (
    <View
      style={{
        backgroundColor: theme.colors.surface1,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 8,
        padding: 12,
        gap: 12,
      }}
    >
      {(request.kind !== "question" || questions.length === 0) && (
        <Text
          style={{
            color: theme.colors.foreground,
            fontSize: 14,
            fontWeight: "600",
          }}
        >
          {request.title ?? request.name}
        </Text>
      )}
      {request.description && (
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 14 }}>
          {request.description}
        </Text>
      )}
      {request.kind === "question" ? (
        questions.length ? (
          questions.map((question) => (
            <View key={question.header} style={{ gap: 8 }}>
              <Text style={{ color: theme.colors.foreground, fontSize: 14 }}>
                {questions.length > 1 ? `${question.header}: ` : ""}
                {question.question}
              </Text>
              {question.options.map((option) => {
                const checked =
                  answers[question.header]?.includes(option.label) ?? false;
                return (
                  <Pressable
                    key={option.label}
                    accessibilityRole={
                      question.multiSelect ? "checkbox" : "radio"
                    }
                    accessibilityState={{
                      checked,
                      disabled: pending || disabled,
                    }}
                    accessibilityLabel={option.label}
                    disabled={pending || disabled}
                    onPress={() => {
                      if (!question.multiSelect)
                        setCustom((previous) => ({
                          ...previous,
                          [question.header]: "",
                        }));
                      setAnswers((previous) => ({
                        ...previous,
                        [question.header]: question.multiSelect
                          ? checked
                            ? (previous[question.header] ?? []).filter(
                                (label) => label !== option.label,
                              )
                            : [
                                ...(previous[question.header] ?? []),
                                option.label,
                              ]
                          : [option.label],
                      }));
                    }}
                    style={{
                      minHeight: 44,
                      padding: 12,
                      borderRadius: 6,
                      backgroundColor: checked
                        ? theme.colors.surface2
                        : theme.colors.surface1,
                      flexDirection: "row",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <Icon
                      name={checked ? "CircleCheck" : "Circle"}
                      size={18}
                      color={
                        checked
                          ? theme.colors.accent
                          : theme.colors.foregroundMuted
                      }
                    />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text
                        style={{ color: theme.colors.foreground, fontSize: 14 }}
                      >
                        {option.label}
                      </Text>
                      {option.description && (
                        <Text
                          style={{
                            color: theme.colors.foregroundMuted,
                            fontSize: 14,
                          }}
                        >
                          {option.description}
                        </Text>
                      )}
                      {option.preview && (
                        <Text
                          selectable
                          style={{
                            color: theme.colors.foregroundMuted,
                            fontSize: 12,
                          }}
                        >
                          {option.preview}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
              {(!question.options.length ||
                question.allowOther ||
                question.isOther) && (
                <TextInput
                  accessibilityLabel={`${question.header} answer`}
                  secureTextEntry={question.isSecret}
                  editable={!pending && !disabled}
                  placeholder={
                    question.placeholder ??
                    (question.options.length ? "Other answer" : "Your answer")
                  }
                  placeholderTextColor={theme.colors.foregroundMuted}
                  value={custom[question.header] ?? ""}
                  onChangeText={(text) => {
                    setCustom((previous) => ({
                      ...previous,
                      [question.header]: text,
                    }));
                    if (!question.multiSelect && text.length > 0)
                      setAnswers((previous) => ({
                        ...previous,
                        [question.header]: [],
                      }));
                  }}
                  style={{
                    color: theme.colors.foreground,
                    backgroundColor: theme.colors.surface2,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    borderRadius: 8,
                    padding: 12,
                    minHeight: 44,
                  }}
                />
              )}
            </View>
          ))
        ) : (
          <Text
            accessibilityRole="alert"
            style={{ color: theme.colors.statusWarning }}
          >
            This question format is unsupported. You can dismiss it safely.
          </Text>
        )
      ) : (
        <ScrollView style={{ maxHeight: 200 }}>
          {request.detail ? (
            <Detail detail={request.detail} theme={theme} />
          ) : request.input ? (
            <Text
              selectable
              style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}
            >
              {readable(request.input)}
            </Text>
          ) : null}
        </ScrollView>
      )}
      {error && (
        <Text
          accessibilityRole="alert"
          style={{ color: theme.colors.statusDanger }}
        >
          {error}
        </Text>
      )}
      <View
        style={{
          flexDirection: layout.compact ? "column" : "row",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {request.actions?.length ? (
          request.actions.map((item) =>
            action(
              item.label,
              item.behavior,
              item.id,
              request.kind === "question" && item.behavior === "allow",
              request.kind === "question" &&
                item.behavior === "allow" &&
                !ready,
            ),
          )
        ) : request.kind === "question" ? (
          <>
            {action("Dismiss", "deny")}
            {action("Submit", "allow", undefined, true, !ready)}
          </>
        ) : (
          <>
            {action("Deny", "deny")}
            {action(request.kind === "plan" ? "Implement" : "Accept", "allow")}
          </>
        )}
      </View>
    </View>
  );
}
