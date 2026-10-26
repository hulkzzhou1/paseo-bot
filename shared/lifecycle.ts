import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";
export const archiveConversation = defineRpc({
  name: "archive-conversation",
  input: z.object({ id: z.uuid() }),
  output: z.object({ id: z.string(), archivedAt: z.string() }),
});
export const inspectWorkspace = defineRpc({
  name: "inspect-workspace",
  input: z.object({}),
  output: z.object({
    workspaceId: z.string().nullable(),
    state: z.enum(["none", "ready", "archived", "unavailable"]),
  }),
});
export const rebuildWorkspace = defineRpc({
  name: "rebuild-workspace",
  input: z.object({ expectedWorkspaceId: z.string().min(1) }),
  output: z.object({ workspaceId: z.string() }),
});
