import type { PaseoApi } from "@getpaseo/client";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

export const configFaultSchema = z.object({
  read: z.enum(["denied", "unavailable"]).optional(),
  write: z
    .enum(["denied", "lost-ack", "not-sent", "commit-unreadable"])
    .optional(),
});
export function configFault(paseo: PaseoApi): PaseoApi {
  const home = process.env.PASEO_HOME;
  if (!home) throw new Error("Isolated daemon home is required");
  const path = join(home, "config-fault.json");
  async function mode() {
    try {
      return configFaultSchema.parse(JSON.parse(await readFile(path, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw error;
    }
  }
  return {
    ...paseo,
    config: {
      async get() {
        const fault = await mode();
        if (fault.read)
          throw Object.assign(new Error("config-secret-canary"), {
            code: fault.read === "denied" ? "access_denied" : "timeout",
          });
        return paseo.config.get();
      },
      async patch(patch) {
        const fault = await mode();
        await appendFile(join(home, "config-patch-attempts.txt"), "patch\n");
        if (fault.write === "denied")
          throw Object.assign(new Error("config-secret-canary"), {
            code: "access_denied",
          });
        if (fault.write === "not-sent")
          throw new Error("config-secret-canary timeout before dispatch");
        const result = await paseo.config.patch(patch);
        if (fault.write === "commit-unreadable")
          await writeFile(
            path,
            JSON.stringify({ ...fault, read: "unavailable" }),
          );
        if (fault.write === "lost-ack" || fault.write === "commit-unreadable")
          throw new Error("config-secret-canary acknowledgement lost");
        return result;
      },
    },
  };
}
