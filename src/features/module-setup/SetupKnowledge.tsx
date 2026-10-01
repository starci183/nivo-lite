"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Alert, Button, SurfaceCard, Text } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { intlLocale, TIME_ZONE } from "@/i18n/core";
import { knowledge } from "@/i18n/dict/knowledge";
import type { ContextNote } from "@/lib/context-notes";
import { approveNoteAndApply, dismissNote, listPendingNotes, loadKnowledgeCounts } from "@/lib/context-notes-actions";
import type { ModuleKey } from "@/lib/modules-shared";
import { CARD_LIST_CLASS, NOTE_CLASS, ROW_WRAP_CLASS, STACK_CLASS } from "@/features/knowledge/classNames";

type SetupKnowledgeProps = {
  readonly installationId: string;
  readonly moduleKey: ModuleKey;
  /** Changes when the draft changes (revision, fact count): reloads the notes. */
  readonly refreshKey: string;
  readonly onApplied: () => void;
};

type Counts = { nivo: number; business: number; publicSources: number };

/** Right column of Setup: the knowledge this module runs on, and notes from Office waiting for approval. */
export const SetupKnowledge = ({ installationId, moduleKey, refreshKey, onApplied }: SetupKnowledgeProps) => {
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

  useEffect(() => { void load(); }, [load, refreshKey]);

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

  return (
    <>
      <SurfaceCard label={t("cardTitle")} headingLevel={2}>
        <div className={STACK_CLASS}>
          <ul className={CARD_LIST_CLASS}>
            <li>{t("cardNivo", { count: counts?.nivo ?? 0 })}</li>
            <li>
              {t("cardBusiness", { count: counts?.business ?? 0 })}
              {counts && counts.business > 0 ? <span className="text-muted"> ({t("cardPublic", { count: counts.publicSources })})</span> : null}
            </li>
          </ul>
          {counts && counts.business === 0 ? <Text size="xs" tone="muted">{t("cardEmpty")}</Text> : null}
          <div className={ROW_WRAP_CLASS}>
            <Link href={`/knowledge?module=${moduleKey}`} className="text-sm underline underline-offset-2">{t("cardLink")}</Link>
            <Link href="/knowledge/nivo" className="text-sm text-muted underline underline-offset-2">{t("nivoLink")}</Link>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard label={t("notesTitle")} headingLevel={2}>
        <div className={STACK_CLASS}>
          <Text size="xs" tone="muted">{t("notesHint")}</Text>
          {notes.length === 0 ? <Text size="sm" tone="muted">{t("notesEmpty")}</Text> : null}
          {notes.map((n) => (
            <div key={n.id} className={NOTE_CLASS}>
              <Text size="sm">{n.body}</Text>
              <Text size="xs" tone="muted">{t("notesFrom", { source: n.source === "office" ? t("notesSourceOffice") : t("notesSourceSetup"), who: n.authorName, when: stamp(n.createdAt) })}</Text>
              <div className={ROW_WRAP_CLASS}>
                <Button variant="ghost" size="sm" isDisabled={isPending} onPress={() => dismiss(n.id)}>{t("notesDismiss")}</Button>
              </div>
            </div>
          ))}
          {notes.length > 0 ? <div><Button variant="primary" isPending={isPending} onPress={approve}>{isPending ? t("notesApproving") : t("notesApprove")}</Button></div> : null}
          {message !== null ? <Alert title={message.ok ? t("notesTitle") : t("notesFailed")} description={message.text} tone={message.ok ? "affirmative" : "negative"} /> : null}
        </div>
      </SurfaceCard>
    </>
  );
};
