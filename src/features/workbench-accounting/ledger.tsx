"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Badge, Button, Drawer, EmptyNotice, Input, SectionHeader, Tabs, Text, Textarea } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { workbenchAccounting } from "@/i18n/dict/workbenchAccounting";
import type { AccountingWorkbench, LedgerEntry, LedgerKind, LedgerStatus, LineageStep } from "@/lib/workbench-accounting";
import { addAdjustment } from "./actions";
import {
  BLOCK_CLASS_NAME, CHIPS_CLASS_NAME, DRAWER_BODY_CLASS_NAME, FILTER_CLASS_NAME, FORM_ACTIONS_CLASS_NAME, LEDGER_ROW_CLASS_NAME, LINEAGE_CLASS_NAME,
  LIST_CLASS_NAME, PANEL_CLASS_NAME, ROW_ASIDE_CLASS_NAME, ROW_MAIN_CLASS_NAME, STEP_CLASS_NAME,
} from "./classNames";
import { digitsToNumber, formatMoney, formatStamp } from "./format";

type Filter = "all" | LedgerKind;

const STATUS_TONE: Record<LedgerStatus, "success" | "warning" | "neutral" | "danger"> = {
  issued: "warning", paid: "success", settled: "neutral", void: "neutral", matched: "success", unmatched: "neutral", needs_review: "warning",
};

const STEP_STATUSES = ["draft", "issued", "paid", "void", "confirmed", "invoiced", "cancelled", "matched", "unmatched", "needs_review", "auto_done", "approved", "edited", "rejected"] as const;
type StepStatus = (typeof STEP_STATUSES)[number];
const isStepStatus = (s: string): s is StepStatus => (STEP_STATUSES as ReadonlyArray<string>).includes(s);

/** One step of the lineage (order, invoice, payment, decision, adjustment), as a labelled line. */
const Step = ({ step }: { readonly step: LineageStep }) => {
  const t = useT(workbenchAccounting);
  const locale = useLocale();
  const title = step.kind === "decision" && (step.title === "issue_invoice" || step.title === "reconcile_payment") ? t(`action_${step.title}`) : step.title;
  return (
    <li className={STEP_CLASS_NAME}>
      <div className={CHIPS_CLASS_NAME}>
        <Badge tone={step.kind === "adjustment" ? "accent" : "neutral"}>{t(`step_${step.kind}`)}</Badge>
        {step.at ? <Text size="xs" tone="muted">{formatStamp(step.at, locale)}</Text> : null}
      </div>
      <Text weight="semibold">{title}</Text>
      {step.detail ? <Text size="sm" tone="muted">{step.detail}</Text> : null}
      <div className={CHIPS_CLASS_NAME}>
        {step.amount !== null ? <Text size="sm">{step.kind === "adjustment" ? t("correctedTo", { amount: formatMoney(step.amount, locale) }) : formatMoney(step.amount, locale)}</Text> : null}
        {step.status && isStepStatus(step.status) ? <Text size="xs" tone="muted">{t(`stepStatus_${step.status}`)}</Text> : null}
      </div>
    </li>
  );
};

/** "Điều chỉnh": a correction note beside the record. The original row is never edited. */
const AdjustForm = ({ entry, onDone }: { readonly entry: LedgerEntry; readonly onDone: () => void }) => {
  const t = useT(workbenchAccounting);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await addAdjustment({ targetType: entry.targetType, targetId: entry.targetId, note, correctedAmount: amount ? digitsToNumber(amount) : null })
        .catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "" }));
      if (!res.ok) return setError(res.error);
      router.refresh();
      onDone();
    });
  };
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); submit(); }} aria-label={t("adjustTitle")}>
      <Text size="sm" tone="muted">{t("adjustIntro")}</Text>
      <Textarea id={`wb-adj-note-${entry.id}`} name="note" label={t("adjustNote")} rows={3} value={note} isRequired isDisabled={isPending} description={t("adjustNoteHint")} onValueChange={setNote} />
      <Input id={`wb-adj-amount-${entry.id}`} name="amount" label={t("adjustAmount")} variant="secondary" value={amount} isDisabled={isPending} hint={t("adjustAmountHint")} onValueChange={setAmount} />
      {error ? <Text size="sm" tone="accent">{error}</Text> : null}
      <div className={FORM_ACTIONS_CLASS_NAME}>
        <Button type="submit" isPending={isPending}>{t("adjustSave")}</Button>
        <Button variant="ghost" isDisabled={isPending} onPress={onDone}>{t("cancel")}</Button>
      </div>
    </form>
  );
};

type EntryDrawerProps = { readonly entry: LedgerEntry | null; readonly canAdjust: boolean; readonly adjustmentsReady: boolean; readonly onClose: () => void };

/** The drawer for one ledger entry: what it is, its lineage and, for owner or manager, the correction form. */
const EntryDrawer = ({ entry, canAdjust, adjustmentsReady, onClose }: EntryDrawerProps) => {
  const t = useT(workbenchAccounting);
  const locale = useLocale();
  const [isAdjusting, setIsAdjusting] = useState(false);
  const closeAll = () => {
    setIsAdjusting(false);
    onClose();
  };
  return (
    <Drawer
      isOpen={entry !== null}
      onOpenChange={(open) => { if (!open) closeAll(); }}
      title={entry ? entry.description : t("ledgerTitle")}
      description={entry ? `${formatStamp(entry.at, locale)} · ${t(`kind_${entry.kind}`)} · ${formatMoney(entry.amount, locale)}` : undefined}
      closeLabel={t("close")}
      placement="right"
    >
      {entry ? (
        <div className={DRAWER_BODY_CLASS_NAME}>
          <section className="flex flex-col gap-3" aria-label={t("lineageTitle")}>
            <SectionHeader level={3} title={t("lineageTitle")} description={t("lineageIntro")} />
            <ol className={LINEAGE_CLASS_NAME}>{entry.lineage.map((step, i) => <Step key={`${step.kind}-${i}`} step={step} />)}</ol>
          </section>
          <section className="flex flex-col gap-3" aria-label={t("adjustTitle")}>
            <SectionHeader level={3} title={t("adjustTitle")} />
            {!adjustmentsReady ? (
              <Text size="sm" tone="muted">{t("adjustNotReady")}</Text>
            ) : !canAdjust ? (
              <Text size="sm" tone="muted">{t("adjustManagersOnly")}</Text>
            ) : isAdjusting ? (
              <AdjustForm entry={entry} onDone={closeAll} />
            ) : (
              <div><Button variant="secondary" onPress={() => setIsAdjusting(true)}>{t("adjustOpen")}</Button></div>
            )}
          </section>
        </div>
      ) : null}
    </Drawer>
  );
};

/** "Sổ": the ledger derived from invoices and payments, with a drawer showing where each line came from. */
export const LedgerPanel = ({ data }: { readonly data: AccountingWorkbench }) => {
  const t = useT(workbenchAccounting);
  const locale = useLocale();
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = useMemo(() => data.ledger.filter((e) => filter === "all" || e.kind === filter), [data.ledger, filter]);
  const open = data.ledger.find((e) => e.id === openId) ?? null;
  return (
    <div className={PANEL_CLASS_NAME}>
      <section className={BLOCK_CLASS_NAME} aria-label={t("ledgerTitle")}>
        <div className={FILTER_CLASS_NAME}>
          <SectionHeader level={2} title={t("ledgerTitle")} description={t("ledgerIntro")} />
          <Tabs
            label={t("kindLabel")}
            selectedKey={filter}
            inset="none"
            labelVisibility="always"
            items={[{ id: "all", label: t("kindAll") }, { id: "income", label: t("kind_income") }, { id: "receivable", label: t("kind_receivable") }]}
            onSelect={(key) => setFilter(key === "income" || key === "receivable" ? key : "all")}
          />
        </div>
        {rows.length === 0 ? (
          <EmptyNotice message={t("ledgerEmpty")} description={t("ledgerEmptyBody")} />
        ) : (
          <ul className={LIST_CLASS_NAME}>
            {rows.map((e) => (
              <li key={e.id}>
                <button type="button" className={LEDGER_ROW_CLASS_NAME} onClick={() => setOpenId(e.id)} aria-label={t("openEntry", { name: e.description })}>
                  <div className={ROW_MAIN_CLASS_NAME}>
                    <Text weight="semibold">{e.description}</Text>
                    <div className={CHIPS_CLASS_NAME}>
                      <Text size="xs" tone="muted">{formatStamp(e.at, locale)}</Text>
                      <Badge tone="neutral">{t(`kind_${e.kind}`)}</Badge>
                      <Badge tone="neutral">{e.origin === "simulated" ? t("originSimulated") : t("originLive")}</Badge>
                      {e.linked ? <Text size="xs" tone="muted">{t("linkedTo", { ref: e.linked })}</Text> : null}
                      {e.adjustmentCount > 0 ? <Badge tone="accent">{t("adjustedN", { n: e.adjustmentCount })}</Badge> : null}
                    </div>
                  </div>
                  <div className={ROW_ASIDE_CLASS_NAME}>
                    <Text weight="semibold">{formatMoney(e.amount, locale)}</Text>
                    <Badge tone={STATUS_TONE[e.status]} isDot>{t(`ledgerStatus_${e.status}`)}</Badge>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        <Text size="xs" tone="muted">{t("ledgerFoot")}</Text>
      </section>
      <EntryDrawer entry={open} canAdjust={data.canAdjust} adjustmentsReady={data.adjustmentsReady} onClose={() => setOpenId(null)} />
    </div>
  );
};
