import type { PluginServerContext } from "@getpaseo/plugin/server";
import {
  bootstrap,
  createConversation,
  listConversations,
  renameConversation,
} from "./shared/contracts.ts";
import { createBot } from "./server/bot.ts";
export default function contribute(server: PluginServerContext) {
  const bot = createBot();
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
  return () => {};
}
