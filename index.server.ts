import type { PluginServerContext } from "@getpaseo/plugin/server";
import { bootstrap, createConversation } from "./shared/contracts.ts";
import { createBot } from "./server/bot.ts";
import { stopConversation, respondConversation } from "./shared/execution.ts";
export default function contribute(server: PluginServerContext) {
  const bot = createBot();
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
  return () => {};
}
