import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";
import { configuration, conversation } from "./contracts.ts";
export const deliveryInput = z
  .object({
    requestId: z.uuid(),
    agentId: z.uuid().optional(),
    text: z.string().trim().min(1).max(100000),
    config: configuration.optional(),
  })
  .refine(
    (input) => Boolean(input.agentId || input.config),
    "Choose a conversation or its configuration",
  );
export const deliveryOutcome = z.object({
  state: z.enum(["accepted", "failed", "unknown", "ready"]),
  message: z.string().optional(),
  conversation: conversation.optional(),
});
export const submitDelivery = defineRpc({
  name: "submit-delivery",
  input: deliveryInput,
  output: deliveryOutcome,
});
export const reconcileDelivery = defineRpc({
  name: "reconcile-delivery",
  input: z.object({ requestId: z.uuid() }),
  output: deliveryOutcome,
});
export const pendingDelivery = z.object({
  input: deliveryInput,
  slot: z.uuid().nullable(),
  revision: z.number().int(),
  text: z.string(),
});
