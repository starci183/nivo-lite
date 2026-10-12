"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Alert, Button, List, ListItem, Skeleton, SurfaceCard, Text, TextAction } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { intlLocale, TIME_ZONE } from "@/i18n/core";
import { knowledge } from "@/i18n/dict/knowledge";
import type { ContextNote } from "@/lib/context-notes";
import { approveNoteAndApply, dismissNote, listPendingNotes, loadKnowledgeCounts } from "@/lib/context-notes-actions";
import type { ModuleKey } from "@/lib/modules-shared";
import { CARD_LIST_CLASS, LIST_CLASS, NOTE_CLASS, ROW_WRAP_CLASS, STACK_CLASS } from "@/features/knowledge/classNames";

type SetupKnowledgeProps = {
  readonly installationId: string;
  readonly moduleKey: ModuleKey;
  /** Changes when the draft changes (revision, fact count): reloads the notes. */
  readonly refreshKey: string;
  readonly onApplied: () => void;
  /** STATE-8: card labels stay, the counts and notes are skeletons and nothing is read. */
  readonly isLoading?: boolean;
};

type Counts = { nivo: number; business: number; publicSources: number };

/** Right column of Setup: the knowledge this module runs on, and notes from Office waiting for approval. */
export const SetupKnowledge = ({ installationId, moduleKey, refreshKey, onApplied, isLoading = false }: SetupKnowledgeProps) => {
  const t = useT(knowledge);
  const locale = useLocale();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [notes, setNotes] = useState<ReadonlyArray<ContextNote>>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, start] = useTransition();

  const load = useCallback(async () => {
    const [c, n] = await Promise.all([loadKnowledgeCounts(moduleKey), listPendingNotes(installationId)]);
    if (c.ok) setCounts(c.data);
    if (n.ok) setNotes(n.data);
  }, [moduleKey, installationId]);

  useEffect(() => { if (!isLoading) void load(); }, [load, refreshKey, isLoading]);

  const stamp = (iso: string) => new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "short", timeStyle: "short", timeZone: TIME_ZONE }).format(new Date(iso));

  const approve = () => {
    setMessage(null);
    start(async () => {
      const r = await approveNoteAndApply(installationId);
      if (!r.ok) { setMessage({ ok: false, text: r.error }); return; }
      setMessage({ ok: true, text: t("notesApplied", { version: r.data.version }) });
      await load();
      onApplied();
    });
  };
  const dismiss = (id: string) => {
    setMessage(null);
    start(async () => {
      const r = await dismissNote(id);
      if (!r.ok) setMessage({ ok: false, text: r.error });
      await load();
      onApplied();
    });
  };

  if (isLoading) {
    return (
      <>
        <SurfaceCard label={t("cardTitle")} headingLevel={2}><Skeleton shape="text" lines={2} /></SurfaceCard>
        <SurfaceCard label={t("notesTitle")} headingLevel={2}><Skeleton shape="text" lines={2} /></SurfaceCard>
      </>
    );
  }

  return (
    <>
      <SurfaceCard label={t("cardTitle")} headingLevel={2}>
        <div className={STACK_CLASS}>
          <List label={t("cardTitle")} className={CARD_LIST_CLASS}>
            <ListItem><Text size="sm">{t("cardNivo", { count: counts?.nivo ?? 0 })}</Text></ListItem>
            <ListItem>
              <Text size="sm">
                {t("cardBusiness", { count: counts?.business ?? 0 })}
                {counts && counts.business > 0 ? <Text as="span" size="sm" tone="muted"> ({t("cardPublic", { count: counts.publicSources })})</Text> : null}
              </Text>
            </ListItem>
          </List>
          {counts && counts.business === 0 ? <Text size="xs" tone="muted">{t("cardEmpty")}</Text> : null}
          <div className={ROW_WRAP_CLASS}>
            <TextAction href={`/knowledge?module=${moduleKey}`} size="sm" appearance="inline">{t("cardLink")}</TextAction>
            <TextAction href="/knowledge/nivo" size="sm" appearance="muted">{t("nivoLink")}</TextAction>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard label={t("notesTitle")} headingLevel={2}>
        <div className={STACK_CLASS}>
          <Text size="xs" tone="muted">{t("notesHint")}</Text>
          {notes.length === 0 ? <Text size="sm" tone="muted">{t("notesEmpty")}</Text> : null}
          {notes.length > 0 ? (
          <List label={t("notesTitle")} className={LIST_CLASS}>
          {notes.map((n) => (
            <ListItem key={n.id} className={NOTE_CLASS}>
              <Text size="sm">{n.body}</Text>
              <Text size="xs" tone="muted">{t("notesFrom", { source: n.source === "office" ? t("notesSourceOffice") : t("notesSourceSetup"), who: n.authorName, when: stamp(n.createdAt) })}</Text>
              <div className={ROW_WRAP_CLASS}>
                <Button variant="ghost" size="sm" isDisabled={isPending} onPress={() => dismiss(n.id)}>{t("notesDismiss")}</Button>
              </div>
            </ListItem>
          ))}
          </List>
          ) : null}
          {notes.length > 0 ? <div className={ROW_WRAP_CLASS}><Button variant="primary" isPending={isPending} onPress={approve}>{isPending ? t("notesApproving") : t("notesApprove")}</Button></div> : null}
          {message !== null ? <Alert title={message.ok ? t("notesTitle") : t("notesFailed")} description={message.text} tone={message.ok ? "affirmative" : "negative"} /> : null}
        </div>
      </SurfaceCard>
    </>
  );
};
