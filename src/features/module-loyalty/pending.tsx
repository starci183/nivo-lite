"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge, Button, EmptyNotice, SurfaceCard, Text, Textarea } from "@starci/grammar/common";
import { canDecideItem, useMember } from "@/features/shell/member-context";
import { useLocale, useT } from "@/i18n/client";
import { loyalty } from "@/i18n/dict/loyalty";
import { decideWorkItem } from "@/lib/flow-actions";
import type { PendingItem } from "@/lib/module-loyalty-queries";
import { formatVndShort } from "@/lib/module-loyalty-shared";
import { CHIPS_CLASS_NAME, FORM_CLASS_NAME, LIST_CLASS_NAME, QUOTE_CLASS_NAME, ROW_ACTIONS_CLASS_NAME, ROW_CLASS_NAME, ROW_MAIN_CLASS_NAME } from "./classNames";
import { daysSince, formatDateTime } from "./format";

const PendingCard = ({ item, nowIso }: { readonly item: PendingItem; readonly nowIso: string }) => {
  const t = useT(loyalty);
  const locale = useLocale();
  const router = useRouter();
  const me = useMember();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(item.draft);
  const [error, setError] = useState<string | null>(null);
  const canAct = canDecideItem(me, null);
  const age = daysSince(item.createdAt, nowIso);

  const onDecide = (decision: "approved" | "rejected") => {
    setError(null);
    setBusy(decision);
    startTransition(async () => {
      const edits = decision === "approved" && item.action === "send_promo" && draft.trim() && draft.trim() !== item.draft ? { draft: draft.trim() } : undefined;
      const result = await decideWorkItem(item.id, decision, edits).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "" }));
      if (result.ok) {
        setIsEditing(false);
        router.refresh();
      } else setError(t("actionFailed", { error: result.error }));
      setBusy(null);
    });
  };

  return (
    <li className={ROW_CLASS_NAME}>
      <div className={ROW_MAIN_CLASS_NAME}>
        <div className={CHIPS_CLASS_NAME}>
          <Badge tone="warning" isDot>{t(`action_${item.action}`)}</Badge>
          <Text as="span" size="xs" tone="muted">{age === 0 ? formatDateTime(item.createdAt, locale) : t("daysAgo", { n: age })}</Text>
        </div>
        {item.customer ? <Text weight="semibold">{item.customer}</Text> : null}
        {item.summary ? <Text size="sm">{item.summary}</Text> : null}
        {item.reason ? <Text size="xs" tone="muted">{t("pendingReason", { reason: item.reason })}</Text> : null}
        {item.action === "redeem_reward" && item.amountVnd !== null ? <Text size="sm" weight="semibold">{t("pendingValue", { value: formatVndShort(item.amountVnd) })}</Text> : null}
        {item.draft && !isEditing ? (
          <div className={QUOTE_CLASS_NAME}>
            <Text size="xs" tone="muted" weight="medium">{t("draftLabel")}</Text>
            <Text as="p" size="sm">{item.action === "send_promo" ? draft : item.draft}</Text>
          </div>
        ) : null}
        {canAct && isEditing && item.action === "send_promo" ? (
          <div className={FORM_CLASS_NAME}>
            <Textarea label={t("draftLabel")} description={t("draftEditHint")} rows={5} value={draft} isDisabled={isPending} onValueChange={setDraft} />
          </div>
        ) : null}
        <div aria-live="polite">{error ? <Text size="sm">{error}</Text> : null}</div>
        {!canAct ? <Text size="sm" weight="medium">{t("waitingManager")}</Text> : null}
      </div>
      {canAct ? (
        <div className={ROW_ACTIONS_CLASS_NAME}>
          <Button variant="primary" size="sm" isPending={isPending && busy === "approved"} isDisabled={isPending} onPress={() => onDecide("approved")}>{t("approve")}</Button>
          {item.action === "send_promo" ? <Button variant="outline" size="sm" isDisabled={isPending} onPress={() => setIsEditing((v) => !v)}>{isEditing ? t("editDone") : t("edit")}</Button> : null}
          <Button variant="danger-soft" size="sm" isPending={isPending && busy === "rejected"} isDisabled={isPending} onPress={() => onDecide("rejected")}>{t("reject")}</Button>
        </div>
      ) : null}
    </li>
  );
};

/** Surface 5: loyalty decisions waiting for a person (points, rewards, promotions), approved or rejected through the same gate as everywhere. */
export const PendingPanel = ({ items, nowIso }: { readonly items: ReadonlyArray<PendingItem>; readonly nowIso: string }) => {
  const t = useT(loyalty);
  return (
    <SurfaceCard ariaLabel={t("tab_pending")}>
      {items.length === 0 ? (
        <EmptyNotice message={t("pendingEmptyTitle")} description={t("pendingEmptyBody")} />
      ) : (
        <ul className={LIST_CLASS_NAME}>
          {items.map((item) => <PendingCard key={item.id} item={item} nowIso={nowIso} />)}
        </ul>
      )}
    </SurfaceCard>
  );
};
