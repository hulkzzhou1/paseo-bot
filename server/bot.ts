import { randomUUID, createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { PaseoApi } from "@getpaseo/client";
import { z } from "zod";
import { configuration } from "../shared/contracts.ts";

const record = z.object({
  id: z.string(),
  workspaceId: z.string(),
  config: configuration,
  hash: z.string(),
});
const stateSchema = z.object({
  installationId: z.string(),
  workspaceId: z.string().nullable(),
  requests: z.record(z.string(), record),
});
export function createBot() {
  const root = join(
    process.env.PASEO_HOME ?? join(homedir(), ".paseo"),
    "plugin-data",
    "paseo-bot",
  );
  const directory = join(
    process.env.PASEO_HOME ?? join(homedir(), ".paseo"),
    "bot",
  );
  let queue: Promise<unknown> = Promise.resolve();
  async function read(): Promise<z.infer<typeof stateSchema>> {
    await mkdir(root, { recursive: true, mode: 0o700 });
    await mkdir(directory, { recursive: true, mode: 0o700 });
    try {
      return stateSchema.parse(
        JSON.parse(await readFile(join(root, "state.json"), "utf8")),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const state = {
        installationId: randomUUID(),
        workspaceId: null,
        requests: {},
      };
      await save(state);
      return state;
    }
  }
  async function save(state: z.infer<typeof stateSchema>) {
    const temporary = join(root, "state.tmp");
    await writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
    await rename(temporary, join(root, "state.json"));
  }
  function serial<T>(fn: () => Promise<T>): Promise<T> {
    const result = queue.then(fn);
    queue = result.catch(() => {});
    return result;
  }
  return {
    bootstrap: () =>
      serial(async () => {
        const state = await read();
        return {
          ...state,
          directory,
          conversations: Object.values(state.requests),
        };
      }),
    create: (
      paseo: PaseoApi,
      input: {
        requestId: string;
        text: string;
        config: z.infer<typeof configuration>;
      },
    ) =>
      serial(async () => {
        const state = await read();
        const hash = createHash("sha256")
          .update(JSON.stringify({ text: input.text, config: input.config }))
          .digest("hex");
        const previous = state.requests[input.requestId];
        if (previous) {
          if (previous.hash !== hash)
            throw new Error(
              "Request identity already belongs to another message",
            );
          const found = await paseo.agents.ref(previous.id).refresh();
          if (found) {
            const handle = paseo.agents.ref(previous.id);
            let page = await handle.timeline.refetch({ limit: 200 });
            for (;;) {
              if (page.error) break;
              if (
                page.entries.some(
                  ({ item }) =>
                    item.type === "user_message" &&
                    item.clientMessageId === input.requestId,
                )
              )
                return previous;
              if (!page.hasOlder || !page.startCursor) break;
              page = await handle.timeline.refetch({
                direction: "before",
                cursor: page.startCursor,
                limit: 200,
              });
            }
          }
          throw new Error(
            "Creation outcome unknown. Reconcile before trying another request.",
          );
        }
        const snapshot = await paseo.providers.waitForReady({ cwd: directory });
        const provider = snapshot.entries.find(
          (entry) =>
            entry.provider === input.config.provider &&
            entry.enabled &&
            entry.status === "ready",
        );
        const model = provider?.models?.find(
          (model) =>
            model.id === input.config.model && model.isSelectable !== false,
        );
        if (!provider || !model)
          throw new Error(
            "The selected provider or model is unavailable. Choose again.",
          );
        if (!provider.modes?.some((mode) => mode.id === input.config.modeId))
          throw new Error(
            "The selected permission mode is unavailable. Choose again.",
          );
        if (model.thinkingOptions?.length && !input.config.thinkingOptionId)
          throw new Error("Choose a thinking option before sending.");
        if (
          input.config.thinkingOptionId &&
          !model.thinkingOptions?.some(
            (option) => option.id === input.config.thinkingOptionId,
          )
        )
          throw new Error(
            "The selected thinking option is unavailable. Choose again.",
          );
        if (state.workspaceId) {
          const workspace = await paseo.workspaces
            .ref(state.workspaceId)
            .refresh();
          if (!workspace)
            throw new Error(
              "Bot workspace is unavailable; no replacement was created.",
            );
          if (workspace.archivingAt)
            throw new Error(
              "Bot workspace is archived; rebuild must be requested explicitly.",
            );
        } else {
          const workspace = await paseo.workspaces.create({
            source: { kind: "directory", path: directory },
            background: true,
            idempotencyKey: `paseo-bot:${state.installationId}`,
          });
          state.workspaceId = workspace.id;
          await save(state);
        }
        const conversation = {
          id: randomUUID(),
          workspaceId: state.workspaceId,
          config: input.config,
          hash,
        };
        state.requests[input.requestId] = conversation;
        await save(state);
        const agent = await paseo.workspaces
          .ref(state.workspaceId)
          .agents.create({
            agentId: conversation.id,
            idempotencyKey: input.requestId,
            config: {
              provider: `${input.config.provider}/${input.config.model}`,
              modeId: input.config.modeId,
              thinkingOptionId: input.config.thinkingOptionId,
            },
            title: input.text.slice(0, 60),
            prompt: input.text,
            clientMessageId: input.requestId,
            labels: { "paseo-bot": state.installationId },
          });
        if (agent.id !== conversation.id)
          throw new Error("Daemon returned a different conversation identity");
        return conversation;
      }),
  };
}
