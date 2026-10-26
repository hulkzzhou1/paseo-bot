import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const stopConversation = defineRpc({
  name: "stop-conversation",
  input: z.object({ agentId: z.uuid() }),
  output: z.object({ stopped: z.literal(true) }),
});
export const questionSchema = z.object({
  header: z.string().min(1),
  question: z.string().min(1),
  options: z
    .array(
      z.object({
        label: z.string().min(1),
        description: z.string().optional(),
        preview: z.string().optional(),
      }),
    )
    .default([]),
  multiSelect: z.boolean().optional(),
  allowOther: z.boolean().optional(),
  isOther: z.boolean().optional(),
  allowEmpty: z.boolean().optional(),
  placeholder: z.string().optional(),
  dismissLabel: z.string().optional(),
  isSecret: z.boolean().optional(),
});
export const questionsSchema = z
  .object({ questions: z.array(questionSchema).min(1) })
  .refine(
    ({ questions }) =>
      new Set(questions.map((q) => q.header)).size === questions.length,
    "Question headers must be unique",
  );
export const respondConversation = defineRpc({
  name: "respond-conversation",
  input: z.object({
    agentId: z.uuid(),
    requestId: z.string().min(1),
    behavior: z.enum(["allow", "deny"]),
    actionId: z.string().optional(),
    answers: z.record(z.string(), z.string()).optional(),
  }),
  output: z.object({ accepted: z.literal(true) }),
});
