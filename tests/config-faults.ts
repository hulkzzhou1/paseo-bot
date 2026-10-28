import { cp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export async function installConfigFaultFixture(home: string) {
  const directory = join(home, "plugin-fixture");
  await mkdir(directory);
  for (const path of [
    "client",
    "server",
    "shared",
    "index.client.tsx",
    "paseo-plugin.json",
    "package.json",
  ])
    await cp(resolve(path), join(directory, path), { recursive: true });
  await symlink(resolve("node_modules"), join(directory, "node_modules"));
  const entry = (await readFile("index.server.ts", "utf8"))
    .replaceAll('"./shared/', '"../shared/')
    .replaceAll('"./server/', '"./');
  await writeFile(join(directory, "server", "contribution.ts"), entry);
  await cp(
    resolve("tests/fixture/server/config-fault.ts"),
    join(directory, "server", "config-fault.ts"),
  );
  await writeFile(
    join(directory, "index.server.ts"),
    `
import type { PluginServerContext } from "@getpaseo/plugin/server";
import contribute from "./server/contribution.ts";
import { configFault } from "./server/config-fault.ts";
export default function fixture(server: PluginServerContext) {
  return contribute({ ...server,
    handle(contract, handler) {
      server.handle(contract, (input, context) => handler(input, { ...context, paseo: configFault(context.paseo) }));
    },
    before(name, handler) {
      return server.before(name, (input, context) => handler(input, { ...context, paseo: configFault(context.paseo) }));
    },
  });
}
`,
  );
  return directory;
}
