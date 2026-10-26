import { randomUUID } from "node:crypto";
import { isAbsolute } from "node:path";
import { createHostClient } from "@getpaseo/client/node";
import {
  waitForDaemonReady,
  readLocalCredentialForTarget,
} from "@getpaseo/server/daemon-control";
const [home, id] = process.argv.slice(2);
if (!home || !isAbsolute(home) || !id)
  throw new Error(
    "An absolute selected daemon home and workspace identity are required",
  );
const instance = await waitForDaemonReady(home, { timeoutMs: 3000 });
const driver = createHostClient(instance.listen, {
  clientId: randomUUID(),
  appVersion: "0.13.2",
  localCredential: () =>
    readLocalCredentialForTarget(home, instance.listen) ?? undefined,
  reconnect: { enabled: false },
});
try {
  await driver.connect();
  const state = await driver.inspectWorkspaceRecovery(id);
  if (
    state.kind === "recoverable" ||
    state.reason === "workspace_directory_missing"
  )
    process.stdout.write(JSON.stringify({ state: "archived" }));
  else if (state.reason === "workspace_not_found")
    process.stdout.write(JSON.stringify({ state: "unavailable" }));
  else
    throw new Error(
      `Workspace state changed or cannot be established (${state.reason}); retry before rebuilding.`,
    );
} finally {
  await driver.close();
}
