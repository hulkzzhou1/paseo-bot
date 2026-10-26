import { execFile } from "node:child_process";
import { isAbsolute } from "node:path";
import { promisify } from "node:util";
export async function renameOwned(id: string, title: string) {
  const home = process.env.PASEO_HOME;
  if (!home || !isAbsolute(home))
    throw new Error(
      "Selected daemon home is unavailable; rename was not attempted.",
    );
  await promisify(execFile)(
    "paseo",
    ["agent", "update", id, "--name", title, "--home", home, "--json"],
    {
      env: Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) => key !== "PASEO_PASSWORD" && key !== "PASEO_HOST",
        ),
      ),
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    },
  );
}
