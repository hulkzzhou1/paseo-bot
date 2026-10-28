import type { PluginServerContext } from "@getpaseo/plugin/server";
import {
  bootstrap,
  openWorkspace,
  createConversation,
  listConversations,
  renameConversation,
} from "./shared/contracts.ts";
import {
  archiveConversation,
  inspectWorkspace,
  rebuildWorkspace,
} from "./shared/lifecycle.ts";
import { createBot } from "./server/bot.ts";
import { createDelivery } from "./server/delivery.ts";
import { submitDelivery, reconcileDelivery } from "./shared/delivery.ts";
import { stopConversation, respondConversation } from "./shared/execution.ts";
import { prepareCoordinator } from "./shared/coordinator.ts";
export default function contribute(server: PluginServerContext) {
  const bot = createBot();
  const delivery = createDelivery(bot);
  server.handle(prepareCoordinator, ({ sourceProfileId }, { paseo }) =>
    bot.prepareCoordinator(paseo, sourceProfileId),
  );
  const unguide = server.before(
    "agent.create",
    async ({ request }, { paseo }) => ({
      ...request,
      config: await bot.guideNative(paseo, request.config),
    }),
  );
  server.handle(openWorkspace, (_, { paseo }) => bot.openWorkspace(paseo));
  server.handle(submitDelivery, (input, { paseo }) =>
    delivery.submit(paseo, input),
  );
  server.handle(reconcileDelivery, ({ requestId }, { paseo }) =>
    delivery.reconcile(paseo, requestId),
  );
  const unhook = server.on("workspace.archived", ({ workspace }) =>
    bot.workspaceArchived(workspace.id, workspace.archivedAt),
  );
  server.handle(inspectWorkspace, (_, { paseo }) => bot.inspect(paseo));
  server.handle(rebuildWorkspace, ({ expectedWorkspaceId }, { paseo }) =>
    bot.rebuild(paseo, expectedWorkspaceId),
  );
  server.handle(archiveConversation, ({ id }, { paseo }) =>
    bot.archive(paseo, id),
  );
  server.handle(respondConversation, (input, { paseo }) =>
    bot.respond(paseo, input),
  );
  server.handle(stopConversation, ({ agentId }, { paseo }) =>
    bot.stop(paseo, agentId),
  );
  server.handle(bootstrap, () => bot.bootstrap());
  server.handle(createConversation, (input, { paseo }) =>
    bot.create(paseo, input),
  );
  server.handle(listConversations, (input, { paseo }) =>
    bot.history(paseo, input),
  );
  server.handle(renameConversation, (input, { paseo }) =>
    bot.rename(paseo, input),
  );
  return () => {
    unhook();
    unguide();
  };
}
