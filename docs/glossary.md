# Glossary

- **Paseo Bot** — Host-specific assistant for managing Paseo work and handling explicitly requested tasks. It is a plugin surface, not a new agent provider.
- **Bot conversation** — One independent Paseo Agent session created through the Bot page.
- **Bot workspace** — Dedicated background workspace whose shared working directory is `~/.paseo/bot/` on its daemon host.
- **Project** — Paseo's record for a selected directory root; the daemon may create it automatically for the Bot workspace.
- **Host** — Connection target for the daemon that owns the Bot workspace and its conversations.
- **Draft** — Unsent text. The Bot retains a device-local new-conversation draft per host; native chat owns drafts in existing conversations. Legacy Bot conversation drafts are not migrated.
- **Archive** — Paseo's existing lifecycle action; archived Bot conversations remain accessible through History. Native chat determines their available actions.
- **Delegated Agent** — Agent assigned work from a Bot conversation and placed in its target business workspace. It is not another Bot conversation.
