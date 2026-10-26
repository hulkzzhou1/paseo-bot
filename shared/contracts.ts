import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const configuration = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  modeId: z.string().min(1),
  thinkingOptionId: z.string().optional(),
});
const conversation = z.object({
  id: z.string(),
  workspaceId: z.string(),
  config: configuration,
});
export const bootstrap = defineRpc({
  name: "bootstrap",
  input: z.object({}),
  output: z.object({
    installationId: z.string(),
    directory: z.string(),
    workspaceId: z.string().nullable(),
    conversations: z.array(conversation),
  }),
});
export const createConversation = defineRpc({
  name: "create-conversation",
  input: z.object({
    requestId: z.uuid(),
    text: z.string().trim().min(1).max(100000),
    config: configuration,
  }),
  output: conversation,
});
