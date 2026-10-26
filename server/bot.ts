import { randomUUID, createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { executeCli } from "./cli.ts";
import {
  questionsSchema,
  type respondConversation,
} from "../shared/execution.ts";
import type { RpcInput } from "@getpaseo/plugin";
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
  async function owned(paseo: PaseoApi, id: string, { mutable = true } = {}) {
    const state = await serial(read);
    const record = Object.values(state.requests).find(
      (entry) => entry.id === id,
    );
    if (!record) throw new Error("Not an owned Bot conversation");
    const result = await paseo.agents.ref(id).refresh();
    if (
      !result ||
      result.agent.workspaceId !== record.workspaceId ||
      result.agent.labels["paseo-bot"] !== state.installationId
    )
      throw new Error("Not an owned Bot conversation");
    if (mutable && result.agent.archivedAt)
      throw new Error("Archived conversations are read-only");
    return result.agent;
  }
  return {
    owned,
    async respond(
      paseo: PaseoApi,
      input: RpcInput<typeof respondConversation>,
    ) {
      const agent = await owned(paseo, input.agentId);
      const request = agent.pendingPermissions.find(
        (request) => request.id === input.requestId,
      );
      if (!request)
        throw new Error(
          "This request is no longer pending in this conversation",
        );
      if (request.actions?.length) {
        const action = request.actions.find(
          (action) => action.id === input.actionId,
        );
        if (!action || action.behavior !== input.behavior)
          throw new Error("Choose a current request action");
      } else if (input.actionId) throw new Error("Unknown request action");
      let updatedInput: Record<string, unknown> | undefined;
      if (request.kind === "question" && input.behavior === "allow") {
        const { questions } = questionsSchema.parse(request.input);
        const answers: Record<string, string> = {};
        for (const question of questions) {
          const answer = input.answers?.[question.header]?.trim() ?? "";
          if (!answer && !question.allowEmpty)
            throw new Error(`Answer ${question.header}`);
          if (
            question.options.length &&
            !question.allowOther &&
            !question.isOther &&
            answer
          ) {
            const selected = question.multiSelect
              ? answer.split(", ")
              : [answer];
            if (
              selected.some(
                (label) =>
                  !question.options.some((option) => option.label === label),
              )
            )
              throw new Error(`Invalid answer for ${question.header}`);
          }
          answers[question.header] = answer;
        }
        updatedInput = { ...request.input, answers };
      }
      await paseo.agents.ref(input.agentId).respondToPermission({
        requestId: input.requestId,
        response:
          input.behavior === "allow"
            ? {
                behavior: "allow",
                selectedActionId: input.actionId,
                ...(updatedInput ? { updatedInput } : {}),
              }
            : { behavior: "deny", selectedActionId: input.actionId },
      });
      return { accepted: true as const };
    },
    async stop(paseo: PaseoApi, id: string) {
      await owned(paseo, id);
      await executeCli(["agent", "stop", id]);
      for (let attempt = 0; attempt < 30; attempt++) {
        const agent = await owned(paseo, id);
        if (
          agent.status !== "running" &&
          agent.status !== "initializing" &&
          !agent.activeTurn &&
          agent.pendingPermissions.length === 0
        )
          return { stopped: true as const };
        await delay(100);
      }
      throw new Error(
        "Stop was not confirmed. The conversation may still be running; refresh and retry.",
      );
    },
    history: (
      paseo: PaseoApi,
      input: { limit: number; cursor?: { updatedAt: string; id: string } },
    ) =>
      serial(async () => {
        const state = await read();
        const entries = [];
        for (const record of Object.values(state.requests)) {
          const found = await paseo.agents.ref(record.id).refresh();
          const agent = found?.agent;
          if (
            !agent ||
            agent.archivedAt ||
            agent.workspaceId !== record.workspaceId ||
            agent.labels["paseo-bot"] !== state.installationId
          )
            continue;
          entries.push({
            ...record,
            title: agent.title ?? "Untitled conversation",
            updatedAt: agent.updatedAt,
            status: agent.pendingPermissions.length
              ? "waiting for confirmation"
              : agent.activeTurn
                ? "running"
                : agent.status,
            archivedAt: agent.archivedAt ?? null,
          });
        }
        entries.sort(
          (a, b) =>
            b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id),
        );
        const cursor = input.cursor;
        const remaining = cursor
          ? entries.filter(
              (entry) =>
                entry.updatedAt < cursor.updatedAt ||
                (entry.updatedAt === cursor.updatedAt && entry.id < cursor.id),
            )
          : entries;
        const page = remaining.slice(0, input.limit);
        const last = page.at(-1);
        return {
          entries: page,
          nextCursor:
            remaining.length > page.length && last
              ? { updatedAt: last.updatedAt, id: last.id }
              : null,
        };
      }),
    rename: async (paseo: PaseoApi, input: { id: string; title: string }) => {
      await owned(paseo, input.id);
      await executeCli(["agent", "update", input.id, "--name", input.title]);
      const updated = await owned(paseo, input.id);
      if (updated.title !== input.title)
        throw new Error(
          "Rename could not be confirmed; refresh history before retrying.",
        );
      return { id: input.id, title: updated.title };
    },
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
