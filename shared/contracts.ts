import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const configuration = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  modeId: z.string().min(1),
  thinkingOptionId: z.string().optional(),
  featureValues: z.record(z.string(), z.unknown()).optional(),
});
export const conversation = z.object({
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
    workspaceIds: z.array(z.string()),
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
export const historyConversation = conversation.omit({ config: true }).extend({
  title: z.string(),
  status: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().nullable(),
});
export const listConversations = defineRpc({
  name: "list-conversations",
  input: z.object({
    cursor: z.object({ updatedAt: z.string(), id: z.string() }).optional(),
    limit: z.number().int().min(1).max(50).default(20),
    archived: z.boolean().default(false),
  }),
  output: z.object({
    entries: z.array(historyConversation),
    nextCursor: z.object({ updatedAt: z.string(), id: z.string() }).nullable(),
  }),
});
export const renameConversation = defineRpc({
  name: "rename-conversation",
  input: z.object({ id: z.uuid(), title: z.string().trim().min(1).max(200) }),
  output: z.object({ id: z.string(), title: z.string() }),
});

export const openWorkspace = defineRpc({
  name: "open-workspace",
  input: z.object({}),
  output: z.object({ workspaceId: z.string() }),
});
