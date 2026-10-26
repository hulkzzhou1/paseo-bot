import { userError } from "../shared/user-error.ts";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRpc, type PluginScreenProps } from "@getpaseo/plugin/client";
import { Modal } from "@getpaseo/plugin/client/ui";
import {
  type historyConversation,
  listConversations,
  renameConversation,
} from "../shared/contracts.ts";
import { archiveConversation } from "../shared/lifecycle.ts";
import type { z } from "zod";
type Entry = z.infer<typeof historyConversation>;
export function HistoryMenu({
  theme,
  compact,
  onSelect,
  onClose,
  onEntries,
  onArchived,
}: {
  theme: PluginScreenProps["theme"];
  compact: boolean;
  onSelect(id: string): void;
  onClose(): void;
  onEntries(entries: Entry[]): void;
  onArchived(id: string, archivedAt: string): void;
}) {
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const list = useRpc(listConversations);
  const rename = useRpc(renameConversation);
  const archive = useRpc(archiveConversation);
  const [showArchived, setShowArchived] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState<Entry | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiveNotice, setArchiveNotice] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [pages, setPages] = useState(1);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: explicit retry refreshes the current page set.
  useEffect(() => {
    let active = true;
    let fetching = false;
    async function refresh() {
      if (fetching) return;
      fetching = true;
      try {
        const all: Entry[] = [];
        let cursor: { updatedAt: string; id: string } | undefined;
        for (let page = 0; page < pages; page++) {
          const result = await list({
            limit: 20,
            cursor,
            archived: showArchived,
          });
          all.push(...result.entries);
          cursor = result.nextCursor ?? undefined;
          if (!cursor) break;
        }
        if (active) {
          setEntries(all);
          onEntries(all);
          setMore(Boolean(cursor));
          setError(null);
        }
      } catch (reason) {
        if (active) setError(userError(reason));
      } finally {
        fetching = false;
        if (active) setLoading(false);
      }
    }
    void refresh();
    const interval = setInterval(() => void refresh(), 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [list, pages, reload, onEntries, showArchived]);
  function action(
    label: string,
    onPress: () => void,
    disabled = false,
    caption = label,
  ) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={{ minHeight: 44, padding: 12, opacity: disabled ? 0.5 : 1 }}
      >
        <Text style={{ color: theme.colors.foreground }}>{caption}</Text>
      </Pressable>
    );
  }
  async function saveName() {
    if (!editing || saving || !title.trim()) return;
    setSaving(true);
    setRenameError(null);
    try {
      await rename({ id: editing.id, title: title.trim() });
      setEditing(null);
      setReload((value) => value + 1);
    } catch (reason) {
      setRenameError(userError(reason));
    } finally {
      setSaving(false);
    }
  }
  const content = (
    <View style={{ gap: 4 }}>
      <Text
        accessibilityRole="header"
        style={{
          color: theme.colors.foreground,
          fontWeight: "600",
          padding: 12,
        }}
      >
        Bot history
      </Text>
      {action(
        showArchived
          ? "Show active conversations"
          : "Show archived conversations",
        () => {
          setShowArchived((value) => !value);
          setPages(1);
          setEntries([]);
          setLoading(true);
        },
      )}
      {archiveNotice && (
        <Text
          accessibilityRole="alert"
          style={{ color: theme.colors.foregroundMuted, padding: 12 }}
        >
          {archiveNotice}
        </Text>
      )}
      {loading && (
        <Text style={{ color: theme.colors.foregroundMuted, padding: 12 }}>
          Loading history…
        </Text>
      )}
      {error && (
        <View>
          <Text
            accessibilityRole="alert"
            style={{ color: theme.colors.statusDanger, padding: 12 }}
          >
            {error}
          </Text>
          {action("Retry history", () => setReload((value) => value + 1))}
        </View>
      )}
      <ScrollView
        style={{ maxHeight: compact ? 420 : 280 }}
        keyboardShouldPersistTaps="handled"
      >
        {entries.map((entry) => (
          <View
            key={entry.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              borderBottomWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${entry.title}, ${entry.status}`}
              onPress={() => onSelect(entry.id)}
              style={{ flex: 1, minHeight: 56, padding: 12, gap: 4 }}
            >
              <Text
                numberOfLines={1}
                style={{ color: theme.colors.foreground }}
              >
                {entry.title}
              </Text>
              <Text
                style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}
              >
                {entry.status}
              </Text>
            </Pressable>
            {!entry.archivedAt &&
              action(
                `Rename ${entry.title}`,
                () => {
                  setRenameError(null);
                  setEditing(entry);
                  setTitle(entry.title);
                },
                false,
                "Rename",
              )}
            {!entry.archivedAt &&
              action(
                `Archive ${entry.title}`,
                () => {
                  setConfirmArchive(entry);
                  setArchiveError(null);
                  setArchiveNotice(null);
                },
                false,
                "Archive",
              )}
          </View>
        ))}
        {!loading && !error && entries.length === 0 && (
          <Text style={{ color: theme.colors.foregroundMuted, padding: 12 }}>
            No Bot conversations yet.
          </Text>
        )}
        {more &&
          action(
            "Load more conversations",
            () => {
              setLoading(true);
              setPages((value) => value + 1);
            },
            loading,
          )}
      </ScrollView>
      {action("Close history", onClose)}
    </View>
  );
  return (
    <>
      {compact ? (
        <Modal
          open
          title="History"
          onOpenChange={(open) => {
            if (!open) onClose();
          }}
        >
          <Modal.Content>{content}</Modal.Content>
        </Modal>
      ) : (
        <View
          style={{
            position: "absolute",
            zIndex: 10,
            right: 0,
            top: 44,
            width: 360,
            maxWidth: "100%",
            backgroundColor: theme.colors.surface1,
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: 12,
          }}
        >
          {content}
        </View>
      )}
      <Modal
        open={confirmArchive !== null}
        title="Archive conversation"
        onOpenChange={(open) => {
          if (!open && !archiving) setConfirmArchive(null);
        }}
      >
        <Modal.Content contentContainerStyle={{ padding: 16, gap: 8 }}>
          <Text style={{ color: theme.colors.foreground }}>
            Archive {confirmArchive?.title}? Running conversations are stopped
            and confirmed first. Archived history stays read-only; drafts and
            shared files are retained.
          </Text>
          {archiveError && (
            <Text
              accessibilityRole="alert"
              style={{ color: theme.colors.statusDanger }}
            >
              {archiveError}
            </Text>
          )}
          {action(
            archiving ? "Stopping and archiving…" : "Confirm archive",
            () => {
              if (!confirmArchive || archiving) return;
              setArchiving(true);
              setArchiveError(null);
              void archive({ id: confirmArchive.id })
                .then((result) => {
                  if (!alive.current) return;
                  onArchived(result.id, result.archivedAt);
                  setConfirmArchive(null);
                  setArchiveNotice(
                    "Conversation archived. View it in archived conversations.",
                  );
                  setReload((value) => value + 1);
                })
                .catch((reason) => {
                  if (alive.current) setArchiveError(userError(reason));
                })
                .finally(() => {
                  if (alive.current) setArchiving(false);
                });
            },
            archiving,
          )}
          {action("Cancel archive", () => setConfirmArchive(null), archiving)}
        </Modal.Content>
      </Modal>
      <Modal
        open={editing !== null}
        title="Rename conversation"
        onOpenChange={(open) => {
          if (!open && !saving) setEditing(null);
        }}
      >
        <Modal.Content contentContainerStyle={{ padding: 16, gap: 8 }}>
          <TextInput
            autoFocus
            accessibilityLabel="Conversation title"
            value={title}
            onChangeText={setTitle}
            maxLength={200}
            editable={!saving}
            style={{
              color: theme.colors.foreground,
              borderColor: theme.colors.border,
              borderWidth: 1,
              borderRadius: 8,
              padding: 12,
              minHeight: 44,
            }}
            onSubmitEditing={() => void saveName()}
          />
          {renameError && (
            <Text
              accessibilityRole="alert"
              style={{ color: theme.colors.statusDanger }}
            >
              {renameError}
            </Text>
          )}
          {action(
            saving ? "Saving name…" : "Save name",
            () => void saveName(),
            saving || !title.trim(),
          )}
          {action("Cancel rename", () => setEditing(null), saving)}
        </Modal.Content>
      </Modal>
    </>
  );
}
