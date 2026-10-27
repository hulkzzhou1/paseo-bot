import type {
  PluginClientContext,
  PluginSidebarItemProps,
  PluginButtonRegistration,
} from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { HistoryScreen } from "./client/history-screen.tsx";
import { bootstrap } from "./shared/contracts.ts";
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
  let active = true;
  const headers = new Map<string, PluginButtonRegistration>();
  const openHistory = () => client.openScreen({ screenId: "history" });
  const registerHistory = (workspaceId: string) => {
    if (!active || headers.has(workspaceId)) return;
    headers.set(
      workspaceId,
      client.addHeaderButton({
        id: "bot-history",
        workspaceId,
        button: {
          title: "Bot history",
          icon: "History",
          behavior: { kind: "action", onPress: openHistory },
        },
      }),
    );
  };
  void client
    .rpc(bootstrap, {})
    .then((state) => {
      for (const id of state.workspaceIds) registerHistory(id);
    })
    .catch(() => {});
  client.addScreen({
    id: "bot",
    title: "Paseo Bot",
    Component: (props) => (
      <BotScreen
        {...props}
        onOpened={registerHistory}
        onHistory={openHistory}
      />
    ),
  });
  client.addScreen({
    id: "history",
    title: "Bot history",
    Component: (props) => (
      <HistoryScreen
        {...props}
        onClose={() => client.openScreen({ screenId: "bot" })}
      />
    ),
  });
  client.addSidebarHeaderItem({
    id: "bot",
    title: "Paseo Bot",
    Component: BotSidebar,
  });
  return () => {
    active = false;
    for (const header of headers.values()) header.remove();
    headers.clear();
  };
}
