import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join, isAbsolute } from "node:path";
import type { PaseoApi, PaseoAgentHandle } from "@getpaseo/client";
import type { RpcInput } from "@getpaseo/plugin";
import { z } from "zod";
import type { createBot } from "./bot.ts";
import { deliveryOutcome, type submitDelivery } from "../shared/delivery.ts";
import { userError } from "../shared/user-error.ts";
const entrySchema = z.object({
  hash: z.string(),
  agentId: z.string().optional(),
  outcome: deliveryOutcome,
});
const journalSchema = z.record(z.string(), entrySchema);

async function contains(handle: PaseoAgentHandle, id: string) {
  let page = await handle.timeline.refetch({ limit: 200 });
  const epoch = page.epoch;
  for (;;) {
    if (page.error || page.epoch !== epoch || page.staleCursor || page.gap)
      throw new Error(
        "History is changing or unavailable. Check delivery again.",
      );
    if (
      page.entries.some(
        ({ item }) =>
          item.type === "user_message" && item.clientMessageId === id,
      )
    )
      return true;
    if (!page.hasOlder || !page.startCursor) return false;
    page = await handle.timeline.refetch({
      direction: "before",
      cursor: page.startCursor,
      limit: 200,
    });
  }
}
export function createDelivery(bot: ReturnType<typeof createBot>) {
  const home = process.env.PASEO_HOME;
  if (!home || !isAbsolute(home))
    throw new Error("Selected daemon home is unavailable");
  const root = join(home, "plugin-data", "paseo-bot");
  const path = join(root, "deliveries.json");
  let queue: Promise<unknown> = Promise.resolve();
  function serial<T>(run: () => Promise<T>) {
    const result = queue.then(run);
    queue = result.catch(() => {});
    return result;
  }
  async function read() {
    try {
      return journalSchema.parse(JSON.parse(await readFile(path, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return {};
    }
  }
  async function save(journal: z.infer<typeof journalSchema>) {
    await mkdir(root, { recursive: true, mode: 0o700 });
    await writeFile(`${path}.tmp`, JSON.stringify(journal), { mode: 0o600 });
    await rename(`${path}.tmp`, path);
  }
  async function check(
    paseo: PaseoApi,
    id: string,
    entry: z.infer<typeof entrySchema>,
  ) {
    if (entry.outcome.state !== "unknown") return entry.outcome;
    const conversation = await bot.findRequest(id);
    const agentId = entry.agentId ?? conversation?.id;
    if (agentId) {
      await bot.owned(paseo, agentId, { mutable: false });
      if (await contains(paseo.agents.ref(agentId), id))
        return {
          state: "accepted" as const,
          ...(conversation ? { conversation } : {}),
        };
    }
    return entry.outcome;
  }
  return {
    reconcile: (paseo: PaseoApi, id: string) =>
      serial(async () => {
        const journal = await read();
        const entry = journal[id];
        if (!entry)
          return {
            state: "ready" as const,
            message:
              "No delivery was recorded. You can retry the original message with its same identity.",
          };
        try {
          entry.outcome = await check(paseo, id, entry);
          await save(journal);
          return entry.outcome;
        } catch (reason) {
          return {
            state: "unknown" as const,
            message: `Delivery is still unknown. ${userError(reason)}`,
          };
        }
      }),
    submit: (paseo: PaseoApi, input: RpcInput<typeof submitDelivery>) =>
      serial(async () => {
        const journal = await read();
        const hash = createHash("sha256")
          .update(
            JSON.stringify({
              agentId: input.agentId,
              text: input.text,
              config: input.config,
            }),
          )
          .digest("hex");
        const previous = journal[input.requestId];
        if (previous) {
          if (previous.hash !== hash)
            throw new Error(
              "Request identity already belongs to another message",
            );
          previous.outcome = await check(paseo, input.requestId, previous);
          await save(journal);
          return previous.outcome;
        }
        if (input.agentId) {
          try {
            const agent = await bot.owned(paseo, input.agentId);
            if (
              agent.status === "running" ||
              agent.status === "initializing" ||
              agent.activeTurn ||
              agent.pendingPermissions.length
            )
              throw new Error(
                "This conversation is running or waiting for your response. Wait or stop it before sending.",
              );
            const providers = await paseo.providers.waitForReady({
              cwd: agent.cwd,
            });
            if (
              !providers.entries.some(
                (provider) =>
                  provider.provider === agent.provider &&
                  provider.enabled &&
                  provider.status === "ready",
              )
            )
              throw new Error(
                "The conversation's Provider is unavailable. Restore it before retrying.",
              );
          } catch (reason) {
            return { state: "failed" as const, message: userError(reason) };
          }
        }
        const entry: z.infer<typeof entrySchema> = {
          hash,
          agentId: input.agentId,
          outcome: {
            state: "unknown",
            message:
              "Delivery is unknown. Check history before trying again; this message will not be sent automatically.",
          },
        };
        journal[input.requestId] = entry;
        await save(journal);
        try {
          if (input.agentId) {
            // shortcut: external sends can race the idle check; use atomic reject-if-busy when the public SDK supports it.
            await paseo.agents
              .ref(input.agentId)
              .send(input.text, { messageId: input.requestId });
          } else {
            if (!input.config)
              throw new Error(
                "Choose a Provider configuration before sending.",
              );
            const conversation = await bot.create(paseo, {
              requestId: input.requestId,
              text: input.text,
              config: input.config,
            });
            entry.agentId = conversation.id;
            entry.outcome = { state: "accepted", conversation };
          }
          if (input.agentId) entry.outcome = { state: "accepted" };
        } catch (reason) {
          if (!input.agentId && !(await bot.findRequest(input.requestId)))
            entry.outcome = { state: "failed", message: userError(reason) };
          else {
            entry.outcome = {
              state: "unknown",
              message: `Delivery is unknown. ${userError(reason)}`,
            };
            try {
              entry.outcome = await check(paseo, input.requestId, entry);
            } catch {
              // Missing verification does not prove that delivery failed.
            }
          }
        }
        await save(journal);
        return entry.outcome;
      }),
  };
}
