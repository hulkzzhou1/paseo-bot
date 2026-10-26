import type {
  PluginClientContext,
  PluginSidebarItemProps,
} from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { BotScreen } from "./client/bot-screen.tsx";
function BotSidebar({ currentScreen, openScreen }: PluginSidebarItemProps) {
  return (
    <SidebarRow
      icon="Bot"
      active={currentScreen?.screenId === "bot"}
      onPress={() => openScreen({ screenId: "bot" })}
    />
  );
}
export default function contribute(client: PluginClientContext) {
  client.addScreen({ id: "bot", title: "Paseo Bot", Component: BotScreen });
  client.addSidebarHeaderItem({
    id: "bot",
    title: "Paseo Bot",
    Component: BotSidebar,
  });
  return () => {};
}
