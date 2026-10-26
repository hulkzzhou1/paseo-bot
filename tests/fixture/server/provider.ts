import type {
  ProviderEvent,
  ProviderTimelineItem,
  ProviderRegistration,
} from "@getpaseo/plugin/server/provider";
const models = [
  {
    id: "test-model",
    label: "Test model",
    thinkingOptions: [{ id: "brief", label: "Brief" }],
  },
];
const modes = [{ id: "approve", label: "Ask for approval" }];
export const provider: ProviderRegistration = {
  id: "bot-test",
  label: "Bot test provider",
  status: async () => ({ available: true }),
  async connect() {
    const listeners = new Set<(event: ProviderEvent) => void>();
    const turns = new Map<string, { id: string; scenario: string }>();
    const history = new Map<string, ProviderTimelineItem[]>();
    function persist(sessionId: string) {
      for (const listener of listeners)
        listener({
          type: "session.persistence",
          sessionId,
          persistence: {
            version: 1,
            data: {
              id: sessionId,
              transcript: JSON.stringify(history.get(sessionId) ?? []),
            },
          },
        });
    }
    function emit(event: ProviderEvent) {
      if (event.type === "timeline.item") {
        const items = history.get(event.sessionId) ?? [];
        const index = items.findIndex((item) => item.id === event.item.id);
        if (index >= 0) items[index] = event.item;
        else items.push(event.item);
        history.set(event.sessionId, items);
      }
      for (const listener of listeners) listener(event);
      if (event.type === "timeline.item") persist(event.sessionId);
    }
    return {
      version: 1,
      capabilities: ["prompt.message", "session.persistence", "permission"],
      onEvent(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      async close() {
        listeners.clear();
      },
      async send(input) {
        if (input.type === "catalog")
          emit({
            type: "catalog",
            requestId: input.requestId,
            catalog: { models, modes },
          });
        if (input.type === "session.open") {
          const data = input.persistence?.data;
          const restored: ProviderTimelineItem[] =
            data &&
            typeof data === "object" &&
            !Array.isArray(data) &&
            typeof data.transcript === "string"
              ? JSON.parse(data.transcript)
              : [];
          history.set(input.sessionId, [...restored]);
          emit({
            type: "session.opened",
            sessionId: input.sessionId,
            requestId: input.requestId,
            cwd: input.config.cwd,
            capabilities: [
              "prompt.message",
              "session.persistence",
              "permission",
            ],
            restoration: "core",
            persistence: {
              version: 1,
              data: {
                id: input.sessionId,
                transcript: JSON.stringify(restored),
              },
            },
          });
          if (input.history === "replay")
            for (const item of restored)
              emit({ type: "timeline.item", sessionId: input.sessionId, item });
          emit({
            type: "session.config",
            sessionId: input.sessionId,
            config: {
              model: "test-model",
              mode: "approve",
              models,
              modes,
              thinkingOptions: [],
              settings: [],
            },
          });
          emit({
            type: "session.ready",
            sessionId: input.sessionId,
            requestId: input.requestId,
          });
        }
        if (input.type === "session.prompt") {
          const turnId = input.prompt.clientMessageId;
          emit({
            type: "session.prompt_result",
            sessionId: input.sessionId,
            clientMessageId: turnId,
            result: { type: "turn", turnId },
          });
          emit({
            type: "session.turn",
            sessionId: input.sessionId,
            turnId,
            state: "started",
          });
          const text =
            input.prompt.input.type === "message"
              ? input.prompt.input.content
                  .filter((part) => part.type === "text")
                  .map((part) => part.text)
                  .join("")
              : "";
          history.get(input.sessionId)?.push({
            id: `${turnId}:user`,
            type: "user_message",
            text,
            clientMessageId: turnId,
          });
          persist(input.sessionId);
          turns.set(input.sessionId, { id: turnId, scenario: text });
          if (text.startsWith("execution")) {
            for (const status of ["running", "completed"] as const)
              emit({
                type: "timeline.item",
                sessionId: input.sessionId,
                item: {
                  id: `${turnId}:tool`,
                  type: "tool_call",
                  callId: `${turnId}:tool`,
                  name: "shell",
                  status,
                  error: null,
                  detail: {
                    type: "shell",
                    command: "printf fixture",
                    cwd: "/fixture",
                    output:
                      status === "completed" ? "fixture tool success" : "",
                    exitCode: status === "completed" ? 0 : null,
                  },
                },
              });
            emit({
              type: "timeline.item",
              sessionId: input.sessionId,
              item: {
                id: `${turnId}:failed`,
                type: "tool_call",
                callId: `${turnId}:failed`,
                name: "shell",
                status: "failed",
                error: "fixture tool failure",
                detail: {
                  type: "shell",
                  command: "false",
                  output: "fixture stderr",
                  exitCode: 1,
                },
              },
            });
            emit({
              type: "session.permission",
              sessionId: input.sessionId,
              request: {
                id: `${turnId}:approval`,
                name: "shell",
                kind: "tool",
                title: "Approve fixture tool",
                detail: { type: "shell", command: "printf approved" },
                actions: [
                  {
                    id: "approve-once",
                    label: "Allow once",
                    behavior: "allow",
                  },
                  { id: "reject", label: "Deny", behavior: "deny" },
                ],
              },
            });
            return;
          }
          if (text.startsWith("hold") || text.startsWith("stop-failure"))
            return;
          emit({
            type: "timeline.item",
            sessionId: input.sessionId,
            item: {
              id: `${turnId}:reply`,
              type: "assistant_message",
              text: "## Hello\n\nStreaming",
            },
          });
          setTimeout(() => {
            emit({
              type: "timeline.item",
              sessionId: input.sessionId,
              item: {
                id: `${turnId}:reply`,
                type: "assistant_message",
                text: "## Hello\n\nStreaming **complete**.",
              },
            });
            emit({
              type: "session.turn",
              sessionId: input.sessionId,
              turnId,
              state: "completed",
            });
          }, 300);
        }
        if (input.type === "session.permission") {
          const turn = turns.get(input.sessionId);
          if (!turn) return;
          emit({
            type: "session.permission_resolved",
            sessionId: input.sessionId,
            permissionId: input.permissionId,
          });
          if (
            input.permissionId.endsWith(":approval") &&
            input.response.behavior === "allow"
          ) {
            emit({
              type: "session.permission",
              sessionId: input.sessionId,
              request: {
                id: `${turn.id}:question`,
                name: "request_user_input",
                kind: "question",
                title: "Fixture questions",
                input: {
                  sentinel: "preserved",
                  questions: [
                    {
                      header: "Choice",
                      question: "Choose fixture options",
                      multiSelect: true,
                      options: [{ label: "One" }, { label: "Two" }],
                      isOther: true,
                    },
                    {
                      header: "Secret",
                      question: "Enter fixture secret",
                      isSecret: true,
                      options: [],
                    },
                  ],
                },
              },
            });
          } else {
            emit({
              type: "timeline.item",
              sessionId: input.sessionId,
              item: {
                id: `${turn.id}:result`,
                type: "assistant_message",
                text: JSON.stringify(input.response),
              },
            });
            emit({
              type: "session.turn",
              sessionId: input.sessionId,
              turnId: turn.id,
              state: "completed",
            });
          }
        }
        if (input.type === "session.interrupt") {
          const turn = turns.get(input.sessionId);
          if (turn?.scenario.startsWith("stop-failure"))
            throw new Error("fixture refused stop");
          if (turn)
            emit({
              type: "session.turn",
              sessionId: input.sessionId,
              turnId: turn.id,
              state: "canceled",
            });
          emit({ type: "request.completed", requestId: input.requestId });
        }
        if (input.type === "session.close")
          emit({ type: "request.completed", requestId: input.requestId });
      },
    };
  },
};
