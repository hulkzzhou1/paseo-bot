import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const prepareCoordinator = defineRpc({
  name: "prepare-coordinator",
  input: z.object({ sourceProfileId: z.string().min(1).optional() }),
  output: z.discriminatedUnion("status", [
    z.object({
      status: z.literal("choose-source"),
      sources: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          provider: z.string(),
          model: z.string().optional(),
          modeId: z.string().optional(),
        }),
      ),
    }),
    z.object({
      status: z.literal("ready"),
      profile: z.object({ id: z.string(), name: z.string() }).nullable(),
    }),
  ]),
});
