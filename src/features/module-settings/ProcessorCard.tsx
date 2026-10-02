"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, SurfaceCard, Text } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { engine as dict } from "@/i18n/dict/engine";
import type { Installation } from "@/lib/modules-shared";
import { STACK_CLASS_NAME } from "./classNames";
import { getAgentSyncStatus, resyncAgent, type AgentSyncStatus } from "./processorActions";

type ProcessorCardProps = { readonly installation: Installation; readonly canEdit: boolean };

/** Poll the sync status this often while a sync is queued or running, and (slower) while idle so a background sync shows up on its own. */
const POLL_BUSY_MS = 2_500;
const POLL_IDLE_MS = 20_000;

/**
 * The agent's OpenClaw copy, quietly: which context version it holds and how long ago it was checked (or syncing / drifted / failed), a "sync again"
 * button. There is no choice of engine: OpenClaw is the default. Owner/manager only.
 */
export const ProcessorCard = ({ installation, canEdit }: ProcessorCardProps) => {
  const t = useT(dict);
  const [sync, setSync] = useState<AgentSyncStatus | undefined>();
  const [note, setNote] = useState<{ ok: boolean; text: string } | undefined>();
  const [queuing, setQueuing] = useState(false);

  const refreshSync = useCallback(async () => {
    const r = await getAgentSyncStatus(installation.id);
    if (r.ok) setSync(r.data);
  }, [installation.id]);

  const syncState = sync?.state;
  useEffect(() => {
    if (!canEdit) return;
    void refreshSync();
    const timer = setInterval(() => void refreshSync(), syncState === "syncing" ? POLL_BUSY_MS : POLL_IDLE_MS);
    return () => clearInterval(timer);
  }, [canEdit, syncState, refreshSync]);

  if (!canEdit) return null;

  const ago = (iso: string): string => {
    const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
    if (s < 90) return t("ago", { n: s });
    if (s < 5400) return t("agoMin", { n: Math.round(s / 60) });
    if (s < 129_600) return t("agoHour", { n: Math.round(s / 3600) });
    return t("agoDay", { n: Math.round(s / 86_400) });
  };

  const syncLine = ((): { text: string; tone: "success" | "warning" | "danger" | "neutral" } | null => {
    if (sync === undefined) return null;
    if (sync.state === "syncing") return { text: t("syncing"), tone: "neutral" };
    if (sync.state === "none") return { text: t("syncNone"), tone: "warning" };
    if (sync.state === "error") return { text: t("syncError", { reason: sync.error ?? "?" }), tone: "danger" };
    if (sync.syncedVersion !== sync.activeVersion) {
      return { text: t("syncDrift", { active: sync.activeVersion ?? t("syncNever"), synced: sync.syncedVersion ?? t("syncNever") }), tone: "warning" };
    }
    const when = sync.checkedAt ? ago(sync.checkedAt) : "";
    return { text: sync.syncedVersion === null ? t("syncOkNone", { ago: when }) : t("syncOk", { version: sync.syncedVersion, ago: when }), tone: "success" };
  })();

  const resync = async () => {
    setNote(undefined);
    setQueuing(true);
    const r = await resyncAgent(installation.id);
    setQueuing(false);
    if (!r.ok || !r.data.queued) { setNote({ ok: false, text: r.ok ? t("resyncFailed") : r.error }); return; }
    setSync((prev) => (prev ? { ...prev, state: "syncing" } : { state: "syncing", syncedVersion: null, activeVersion: null, checkedAt: null, error: null, fileCount: 0 }));
  };

  return (
    <SurfaceCard label={t("title")} headingLevel={2}>
      <div className={STACK_CLASS_NAME}>
        <div className="flex flex-wrap items-center gap-3" aria-live="polite">
          <Badge isDot tone={syncLine?.tone ?? "neutral"}>{syncLine?.text ?? "…"}</Badge>
          <Button variant="secondary" size="sm" isPending={queuing} isDisabled={queuing || sync?.state === "syncing"} onPress={() => void resync()}>{t("resync")}</Button>
        </div>
        <Text size="xs" tone="muted">{t("help")}</Text>
        {note !== undefined ? <Alert title={note.ok ? t("saved") : t("notSaved")} description={note.ok ? undefined : note.text} tone={note.ok ? "affirmative" : "negative"} /> : null}
      </div>
    </SurfaceCard>
  );
};
