import { execFile } from "node:child_process";
import { isAbsolute } from "node:path";
import { promisify } from "node:util";

export async function executeCli(args: string[]) {
  const home = process.env.PASEO_HOME;
  if (!home || !isAbsolute(home))
    throw new Error(
      "Selected daemon home is unavailable; refusing CLI operation.",
    );
  return promisify(execFile)("paseo", [...args, "--home", home, "--json"], {
    timeout: 15000,
    maxBuffer: 1024 * 1024,
    env: Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) => key !== "PASEO_PASSWORD" && key !== "PASEO_HOST",
      ),
    ),
  });
}
