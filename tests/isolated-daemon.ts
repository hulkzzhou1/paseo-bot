import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type { RpcOutput } from "@getpaseo/plugin";
import {
  bootstrap,
  createConversation,
  listConversations,
  renameConversation,
} from "../shared/contracts.ts";
import { createPaseoApi } from "@getpaseo/client";
import { hashDaemonPassword } from "@getpaseo/server/auth";
import { createHostClient } from "@getpaseo/client/node";

export async function createIsolatedDaemon(
  options: { keep?: boolean; port?: number; fixture?: boolean } = {},
) {
  const home = await mkdtemp(join(tmpdir(), "paseo-bot-test-"));
  const reservation = createServer();
  await new Promise<void>((resolve) =>
    reservation.listen(0, "127.0.0.1", resolve),
  );
  const allocated = reservation.address();
  if (!allocated || typeof allocated === "string")
    throw new Error("No loopback port");
  const port = options.port ?? allocated.port;
  const password = randomUUID();
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  await writeFile(
    join(home, "config.json"),
    JSON.stringify({
      daemon: {
        listen: `127.0.0.1:${port}`,
        relay: { enabled: false },
        auth: { password: hashDaemonPassword(password) },
      },
      features: { webUi: { enabled: true } },
      pluginsEnabled: true,
      plugins: {
        "paseo-bot": { source: "directory", path: resolve("."), enabled: true },
        ...(options.fixture
          ? {
              "bot-test-provider": {
                source: "directory",
                path: resolve("tests/fixture"),
                enabled: true,
              },
            }
          : {}),
      },
    }),
  );
  const logPath = join(home, "daemon.log");
  const child = spawn(
    process.env.PASEO_TEST_CLI ?? "paseo",
    ["daemon", "run", "--home", home],
    {
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(
            ([key]) => !key.startsWith("PASEO_"),
          ),
        ),
        PASEO_HOME: home,
        PASEO_LISTEN: `127.0.0.1:${port}`,
        PASEO_RELAY_ENABLED: "false",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const output: string[] = [];
  child.stdout.on("data", (chunk) => output.push(String(chunk)));
  child.stderr.on("data", (chunk) => output.push(String(chunk)));
  const driver = createHostClient(`ws://127.0.0.1:${port}/ws`, {
    clientId: randomUUID(),
    appVersion: "0.13.2",
    password,
    reconnect: { enabled: false },
  });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await driver.connect();
      ready = true;
      break;
    } catch {
      await delay(150);
    }
  }
  if (!ready) {
    child.kill("SIGTERM");
    throw new Error(output.join(""));
  }
  const client = createPaseoApi(driver);
  function rpc(
    method: "bootstrap",
    input: unknown,
  ): Promise<RpcOutput<typeof bootstrap>>;
  function rpc(
    method: "create-conversation",
    input: unknown,
  ): Promise<RpcOutput<typeof createConversation>>;
  function rpc(
    method: "list-conversations",
    input: unknown,
  ): Promise<RpcOutput<typeof listConversations>>;
  function rpc(
    method: "rename-conversation",
    input: unknown,
  ): Promise<RpcOutput<typeof renameConversation>>;
  async function rpc(method: string, input: unknown): Promise<unknown> {
    const output = await driver.invokePluginRpc("paseo-bot", method, input);
    return (
      method === "bootstrap"
        ? bootstrap
        : method === "list-conversations"
          ? listConversations
          : method === "rename-conversation"
            ? renameConversation
            : createConversation
    ).output.parse(output);
  }
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await rpc("bootstrap", {});
      break;
    } catch (error) {
      if (attempt === 99) {
        child.kill("SIGTERM");
        throw error;
      }
      await delay(150);
    }
  }
  return {
    home,
    port,
    password,
    client,
    rpc,
    async close() {
      await client.dispose();
      await driver.close();
      child.kill("SIGTERM");
      await once(child, "exit");
      await writeFile(logPath, output.join(""));
      if (!options.keep) await rm(home, { recursive: true, force: true });
    },
  };
}
