import type { PluginServerContext } from "@getpaseo/plugin/server";
import { provider } from "./server/provider.ts";
export default function contribute(server: PluginServerContext) {
  server.registerProvider(provider);
  server.registerProvider({
    ...provider,
    id: "bot-other",
    label: "Other test provider",
  });
  return () => {};
}
