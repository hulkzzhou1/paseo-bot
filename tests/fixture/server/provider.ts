import type {
  ProviderEvent,
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
    function emit(event: ProviderEvent) {
      for (const listener of listeners) listener(event);
    }
    return {
      version: 1,
      capabilities: ["prompt.message", "session.persistence"],
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
          emit({
            type: "session.opened",
            sessionId: input.sessionId,
            requestId: input.requestId,
            cwd: input.config.cwd,
            capabilities: ["prompt.message", "session.persistence"],
            restoration: "core",
            persistence: { version: 1, data: { id: input.sessionId } },
          });
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
        if (input.type === "session.close")
          emit({ type: "request.completed", requestId: input.requestId });
      },
    };
  },
};
