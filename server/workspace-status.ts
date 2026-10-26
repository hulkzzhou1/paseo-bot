import { execFile } from "node:child_process";
import { isAbsolute, join } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { executeCli } from "./cli.ts";
export async function inspectArchivedWorkspace(id: string) {
  const home = process.env.PASEO_HOME;
  if (!home || !isAbsolute(home))
    throw new Error(
      "Selected daemon home is unavailable; inspection was not attempted.",
    );
  const listed = await executeCli(["plugin", "ls", "paseo-bot"]);
  const plugins = z
    .array(z.object({ id: z.string(), path: z.string() }))
    .parse(JSON.parse(listed.stdout));
  const plugin = plugins.find((entry) => entry.id === "paseo-bot");
  if (!plugin || !isAbsolute(plugin.path))
    throw new Error(
      "Installed Bot source path could not be established; inspection was not attempted.",
    );
  const result = await promisify(execFile)(
    process.execPath,
    [join(plugin.path, "server", "recovery-probe.mjs"), home, id],
    {
      timeout: 15000,
      maxBuffer: 1024 * 1024,
      env: Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) => key !== "PASEO_PASSWORD" && key !== "PASEO_HOST",
        ),
      ),
    },
  );
  return z
    .object({ state: z.enum(["archived", "unavailable"]) })
    .parse(JSON.parse(result.stdout)).state;
}
