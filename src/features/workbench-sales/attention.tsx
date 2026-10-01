"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge, Button, EmptyNotice, SurfaceCard, Text, type BadgeTone } from "@starci/grammar/common";
import Link from "next/link";
import { useT } from "@/i18n/client";
import { governance } from "@/i18n/dict/governance";
import { workbenchSales } from "@/i18n/dict/workbenchSales";
import type { AttentionKind, AttentionRow } from "@/lib/workbench-sales";
import { retryFailedStep, stopFailedStep } from "./actions";
import { CHIPS_CLASS_NAME, LIST_CLASS_NAME, ROW_ACTIONS_CLASS_NAME, ROW_CLASS_NAME, ROW_MAIN_CLASS_NAME } from "./classNames";
import { AgeText, StageBadge, useFieldLabel } from "./parts";

const KIND_TONE: Record<AttentionKind, BadgeTone> = { decision: "warning", clarify: "warning", failed: "danger", overdue: "danger", awaiting_reply: "accent" };

/** Props for {@link AttentionPanel}. */
export type AttentionPanelProps = {
  readonly rows: ReadonlyArray<AttentionRow>;
  readonly nowIso: string;
  /** Open one pending decision in the Decisions surface. */
  readonly onOpenDecision: (decisionId: string) => void;
};

const AttentionItem = ({ row, nowIso, onOpenDecision }: { readonly row: AttentionRow; readonly nowIso: string; readonly onOpenDecision: (id: string) => void }) => {
  const t = useT(workbenchSales);
  const g = useT(governance);
  const fieldLabel = useFieldLabel();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"retry" | "stop" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (kind: "retry" | "stop") => {
    if (!row.workItemId) return;
    const id = row.workItemId;
    setError(null);
    setBusy(kind);
    startTransition(async () => {
      const result = await (kind === "retry" ? retryFailedStep(id) : stopFailedStep(id)).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "" }));
      if (result.ok) router.refresh();
      else setError(t("actionFailed", { error: result.error }));
      setBusy(null);
    });
  };

  const need = row.kind === "clarify" && row.missing.length
    ? t("needMissing", { fields: row.missing.map(fieldLabel).join(", ") })
    : row.need;
  const title = row.action && row.kind !== "overdue" && row.kind !== "awaiting_reply" ? g(`action_${row.action}`) : null;

  return (
    <li className={ROW_CLASS_NAME}>
      <div className={ROW_MAIN_CLASS_NAME}>
        <div className={CHIPS_CLASS_NAME}>
          <Badge tone={KIND_TONE[row.kind]} isDot>{t(`kind_${row.kind}`)}</Badge>
          <StageBadge stage={row.stage} />
          <AgeText since={row.since} nowIso={nowIso} />
        </div>
        {row.leadId ? (
          <Link href={`/leads/${row.leadId}`}>
            <Text as="span" weight="semibold">{row.customer}{row.company ? ` · ${row.company}` : ""}</Text>
          </Link>
        ) : (
          <Text weight="semibold">{row.customer}</Text>
        )}
        {title ? <Text size="sm" weight="medium">{title}</Text> : null}
        {need ? <Text size="sm" tone="muted" overflow="clamp-2">{need}</Text> : null}
        <Text size="xs" tone="muted">{row.owner ? t("owner", { name: row.owner }) : t("ownerNone")}</Text>
        {error ? <Text size="sm" live="assertive">{error}</Text> : null}
      </div>
      <div className={ROW_ACTIONS_CLASS_NAME}>
        {row.kind === "decision" || row.kind === "clarify" ? (
          <Button variant="primary" size="sm" onPress={() => row.decisionId && onOpenDecision(row.decisionId)}>{row.kind === "clarify" ? t("actionAnswer") : t("actionDecide")}</Button>
        ) : null}
        {row.kind === "failed" ? (
          <>
            <Button variant="primary" size="sm" isPending={isPending && busy === "retry"} isDisabled={isPending} onPress={() => run("retry")}>{t("actionRetry")}</Button>
            <Button variant="outline" size="sm" isPending={isPending && busy === "stop"} isDisabled={isPending} onPress={() => run("stop")}>{t("actionStop")}</Button>
          </>
        ) : null}
        {row.kind === "overdue" && row.leadId ? <Button variant="primary" size="sm" href={`/leads/${row.leadId}`}>{t("actionFollowUp")}</Button> : null}
        {row.kind === "awaiting_reply" && row.leadId ? <Button variant="primary" size="sm" href={`/leads/${row.leadId}`}>{t("actionReply")}</Button> : null}
      </div>
    </li>
  );
};

/** Surface 1: opportunities that need a person, most urgent first. */
export const AttentionPanel = ({ rows, nowIso, onOpenDecision }: AttentionPanelProps) => {
  const t = useT(workbenchSales);
  if (rows.length === 0) {
    return (
      <SurfaceCard ariaLabel={t("tab_attention")}>
        <EmptyNotice message={t("attentionEmptyTitle")} description={t("attentionEmptyBody")} />
      </SurfaceCard>
    );
  }
  return (
    <SurfaceCard ariaLabel={t("tab_attention")}>
      <ul className={LIST_CLASS_NAME}>
        {rows.map((row) => <AttentionItem key={row.key} row={row} nowIso={nowIso} onOpenDecision={onOpenDecision} />)}
      </ul>
    </SurfaceCard>
  );
};
