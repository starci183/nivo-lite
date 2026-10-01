"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge, Button, EmptyNotice, Input, SectionHeader, SurfaceCard, Text, Textarea, type BadgeTone } from "@starci/grammar/common";
import { splitBasis } from "@/features/decisions/format";
import { canDecideItem, useMember } from "@/features/shell/member-context";
import { useLocale, useT } from "@/i18n/client";
import { governance } from "@/i18n/dict/governance";
import { workbenchSales } from "@/i18n/dict/workbenchSales";
import { decideExecution } from "@/lib/actions";
import { decideWorkItem } from "@/lib/flow-actions";
import type { DecisionRow, WorkEdits } from "@/lib/flow-types";
import type { SalesDecision } from "@/lib/workbench-sales";
import { CHIPS_CLASS_NAME, FORM_CLASS_NAME, LIST_CLASS_NAME, QUOTE_CLASS_NAME, ROW_ACTIONS_CLASS_NAME, ROW_CLASS_NAME, ROW_MAIN_CLASS_NAME } from "./classNames";
import { formatDateTime, formatVnd, parseAmount } from "./format";
import { AgeText, useFieldLabel } from "./parts";

/** DOM id of one pending decision, so the Attention surface can jump to it. */
export const decisionAnchor = (id: string): string => `sales-decision-${id}`;

const OUTCOME_TONE: Record<DecisionRow["outcome"], BadgeTone> = { auto_done: "success", approved: "accent", edited: "warning", rejected: "danger" };

/** Props for {@link DecisionsPanel}. */
export type DecisionsPanelProps = {
  readonly pending: ReadonlyArray<SalesDecision>;
  readonly decided: ReadonlyArray<DecisionRow>;
  readonly nowIso: string;
  /** The decision to scroll to and highlight (set when opened from the Attention surface). */
  readonly focusId: string | null;
};

const PendingCard = ({ item, nowIso, isFocused }: { readonly item: SalesDecision; readonly nowIso: string; readonly isFocused: boolean }) => {
  const t = useT(workbenchSales);
  const g = useT(governance);
  const fieldLabel = useFieldLabel();
  const locale = useLocale();
  const router = useRouter();
  const me = useMember();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(item.draft);
  const [amount, setAmount] = useState(item.amountVnd !== null ? String(item.amountVnd) : "");
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const canAct = canDecideItem(me, item.assignedStaffId);
  const missing = item.missing;
  const isIncomplete = missing.some((name) => !(values[name] ?? "").trim());
  const actionLabel = item.action === "follow_up" ? g("action_send_follow_up") : g(`action_${item.action}`);

  const buildEdits = (): WorkEdits | undefined => {
    const edits: WorkEdits = {};
    const fields: Record<string, string | number | null> = {};
    for (const name of missing) {
      const raw = (values[name] ?? "").trim();
      if (!raw) continue;
      if (name === "amount_vnd") {
        edits.amount_vnd = parseAmount(raw);
        fields[name] = parseAmount(raw);
      } else fields[name] = raw;
    }
    if (Object.keys(fields).length) edits.fields = fields;
    if (isEditing) {
      if (draft.trim() && draft.trim() !== item.draft) edits.draft = draft.trim();
      if (item.hasAmount && !missing.includes("amount_vnd")) {
        const next = parseAmount(amount);
        if (next !== item.amountVnd) edits.amount_vnd = next;
      }
    }
    return Object.keys(edits).length ? edits : undefined;
  };

  const onDecide = (decision: "approved" | "rejected") => {
    setError(null);
    setBusy(decision);
    startTransition(async () => {
      const result = item.source === "execution" && item.executionId
        ? await decideExecution(item.executionId, decision, decision === "approved" && isEditing && draft.trim() !== item.draft ? draft.trim() : undefined)
        : await decideWorkItem(item.id, decision, decision === "approved" ? buildEdits() : undefined);
      const settled = await Promise.resolve(result).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "" }));
      if (settled.ok) {
        setIsEditing(false);
        router.refresh();
      } else setError(t("actionFailed", { error: settled.error }));
      setBusy(null);
    });
  };

  return (
    <li id={decisionAnchor(item.id)} className={`${ROW_CLASS_NAME} ${isFocused ? "bg-surface-secondary" : ""}`}>
      <div className={ROW_MAIN_CLASS_NAME}>
        <div className={CHIPS_CLASS_NAME}>
          <Badge tone="warning" isDot>{item.reason ? g(`reason_${item.reason}`) : t("kind_decision")}</Badge>
          <AgeText since={item.createdAt} nowIso={nowIso} />
        </div>
        {item.leadId ? (
          <Link href={`/leads/${item.leadId}`}>
            <Text as="span" weight="semibold">{item.customer}</Text>
          </Link>
        ) : (
          <Text weight="semibold">{item.customer}</Text>
        )}
        <Text size="sm" weight="medium">{actionLabel}</Text>
        {item.summary ? <Text size="sm" tone="muted">{item.summary}</Text> : null}
        {item.reason && item.reason !== "routine" ? <Text size="xs" tone="muted">{g(`reasonHint_${item.reason}`)}</Text> : null}
        {item.hasAmount && !missing.includes("amount_vnd") && !isEditing ? <Text size="sm" weight="semibold">{formatVnd(item.amountVnd, locale)}</Text> : null}

        {item.draft && !isEditing ? (
          <div className={QUOTE_CLASS_NAME}>
            <Text size="xs" tone="muted" weight="medium">{t("draftLabel")}</Text>
            <Text as="p" size="sm">{item.draft}</Text>
          </div>
        ) : null}

        {canAct && (missing.length > 0 || isEditing) ? (
          <div className={FORM_CLASS_NAME}>
            {missing.map((name) => (
              <Input
                key={name}
                id={`${item.id}-${name}`}
                name={name}
                label={fieldLabel(name)}
                variant="secondary"
                value={values[name] ?? ""}
                isDisabled={isPending}
                onValueChange={(v) => setValues((cur) => ({ ...cur, [name]: v }))}
              />
            ))}
            {isEditing && item.draft ? <Textarea label={t("draftLabel")} rows={4} value={draft} isDisabled={isPending} onValueChange={setDraft} /> : null}
            {isEditing && item.hasAmount && !missing.includes("amount_vnd") ? (
              <Input id={`${item.id}-amount`} name="amount_vnd" label={g("field_amount_vnd")} variant="secondary" value={amount} isDisabled={isPending} onValueChange={setAmount} />
            ) : null}
          </div>
        ) : null}

        {error ? <Text size="sm" live="assertive">{error}</Text> : null}
        {!canAct ? <Text size="sm" weight="medium" live="polite">{t("waitingManager")}</Text> : null}
        {item.assignedStaffName ? <Text size="xs" tone="muted">{t("assignedTo", { name: item.assignedStaffName })}</Text> : null}
      </div>
      {canAct ? (
        <div className={ROW_ACTIONS_CLASS_NAME}>
          <Button variant="primary" size="sm" isPending={isPending && busy === "approved"} isDisabled={isPending || isIncomplete} onPress={() => onDecide("approved")}>{t("approve")}</Button>
          {item.draft || item.hasAmount ? <Button variant="outline" size="sm" isDisabled={isPending} onPress={() => setIsEditing((v) => !v)}>{isEditing ? t("editDone") : t("edit")}</Button> : null}
          <Button variant="danger-soft" size="sm" isPending={isPending && busy === "rejected"} isDisabled={isPending} onPress={() => onDecide("rejected")}>{t("reject")}</Button>
        </div>
      ) : null}
    </li>
  );
};

/** Surface 3: sales decisions waiting for a person (same path and permissions as everywhere), then the ones already made. */
export const DecisionsPanel = ({ pending, decided, nowIso, focusId }: DecisionsPanelProps) => {
  const t = useT(workbenchSales);
  const g = useT(governance);
  const locale = useLocale();
  return (
    <>
      <SurfaceCard ariaLabel={t("pendingTitle")}>
        {pending.length === 0 ? (
          <EmptyNotice message={t("decisionsEmptyTitle")} description={t("decisionsEmptyBody")} />
        ) : (
          <ul className={LIST_CLASS_NAME}>
            {pending.map((d) => <PendingCard key={d.id} item={d} nowIso={nowIso} isFocused={focusId === d.id} />)}
          </ul>
        )}
      </SurfaceCard>
      <SectionHeader level={2} title={t("decidedTitle")} description={t("decidedBody")} />
      <SurfaceCard ariaLabel={t("decidedTitle")}>
        {decided.length === 0 ? (
          <EmptyNotice message={t("decidedEmptyTitle")} description={t("decidedEmptyBody")} />
        ) : (
          <ul className={LIST_CLASS_NAME}>
            {decided.map((row) => (
              <li key={row.id} className={ROW_CLASS_NAME}>
                <div className={ROW_MAIN_CLASS_NAME}>
                  <div className={CHIPS_CLASS_NAME}>
                    <Text as="span" weight="semibold">{g(`action_${row.action}`)}</Text>
                    <Badge tone={OUTCOME_TONE[row.outcome]}>{g(`outcome_${row.outcome}`)}</Badge>
                  </div>
                  {row.lead_id ? (
                    <Link href={`/leads/${row.lead_id}`}>
                      <Text as="span" size="sm" weight="medium">{row.leadName ?? t("openCustomer")}</Text>
                    </Link>
                  ) : null}
                  <Text size="xs" tone="muted">{t("decidedBy", { who: row.decider_kind === "policy" ? g("decider_policy") : row.decided_by, time: formatDateTime(row.created_at, locale) })}</Text>
                  {(() => {
                    const { basis, rest } = splitBasis(row.note);
                    return (
                      <>
                        {basis ? <Text size="sm" weight="medium">{t("basis", { basis })}</Text> : null}
                        {rest ? <Text size="sm" tone="muted" overflow="clamp-2">{rest}</Text> : null}
                      </>
                    );
                  })()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SurfaceCard>
    </>
  );
};
