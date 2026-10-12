"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, EmptyNotice, ListRow, SurfaceListCard, Text, Textarea } from "@starci/grammar/common";
import { formatWhen } from "@/features/agent-dashboard";
import { useLocale, useT } from "@/i18n/client";
import { workbenchLeadGen } from "@/i18n/dict/workbenchLeadGen";
import { decideWorkItem } from "@/lib/flow-actions";
import type { LeadGenComment } from "@/lib/workbench-lead-gen";
import { ACTIONS_CLASS_NAME, FORM_CLASS_NAME } from "./classNames";
import { SourceBadge } from "./parts";

const CommentRow = ({ row }: { readonly row: LeadGenComment }) => {
  const t = useT(workbenchLeadGen);
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(row.draft);
  const [error, setError] = useState<string | null>(null);

  const approve = (edited: boolean) => {
    setError(null);
    startTransition(async () => {
      const result = await decideWorkItem(row.workItemId, "approved", edited ? { draft } : undefined).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "" }));
      if (result.ok) router.refresh();
      else setError(t("actionFailed", { error: result.error }));
    });
  };

  return (
    <ListRow
      title={row.author ? t("commentFrom", { name: row.author }) : t("commentAnonymous")}
      description={[row.refLabel, formatWhen(row.at, locale)].filter(Boolean).join(" · ")}
      badges={<SourceBadge origin={{ platform: row.platform, kind: "comment" }} />}
      actions={
        isEditing ? null : (
          <div className={ACTIONS_CLASS_NAME}>
            <Button variant="outline" size="sm" isDisabled={isPending} onPress={() => setIsEditing(true)}>{t("edit")}</Button>
            <Button variant="primary" size="sm" isPending={isPending} isDisabled={isPending || !row.draft} onPress={() => approve(false)}>{t("approve")}</Button>
          </div>
        )
      }
    >
      <div className={FORM_CLASS_NAME}>
        <Text as="p" size="sm">{row.comment}</Text>
        {isEditing ? (
          <>
            <Textarea label={t("draftLabel")} variant="secondary" rows={3} value={draft} isDisabled={isPending} onValueChange={setDraft} />
            <div className={ACTIONS_CLASS_NAME}>
              <Button variant="outline" size="sm" isDisabled={isPending} onPress={() => { setIsEditing(false); setDraft(row.draft); }}>{t("cancel")}</Button>
              <Button variant="primary" size="sm" isPending={isPending} isDisabled={isPending || !draft.trim()} onPress={() => approve(true)}>{t("saveApprove")}</Button>
            </div>
          </>
        ) : (
          <Text as="p" size="sm" tone="muted">{row.draft || t("noDraft")}</Text>
        )}
        {error ? <Text size="sm" live="assertive">{error}</Text> : null}
      </div>
    </ListRow>
  );
};

/** Props for {@link CommentsPanel}. */
export type CommentsPanelProps = { readonly rows: ReadonlyArray<LeadGenComment> };

/** "Bình luận": public replies that wait for a person (ask mode). Approve posts the drafted reply, Edit changes it first. */
export const CommentsPanel = ({ rows }: CommentsPanelProps) => {
  const t = useT(workbenchLeadGen);
  return (
    <SurfaceListCard ariaLabel={t("commentsLabel")} empty={<EmptyNotice message={t("commentsEmptyTitle")} description={t("commentsEmptyBody")} />}>
      {rows.map((row) => <CommentRow key={row.workItemId} row={row} />)}
    </SurfaceListCard>
  );
};
