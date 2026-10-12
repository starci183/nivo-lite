"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { parseDate, type DateValue } from "@internationalized/date";
import { Alert, Badge, Button, DateField, EmptyNotice, Form, Input, SectionHeader, SurfaceCard, SurfaceListCard, Text, Textarea } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { workbenchAccounting } from "@/i18n/dict/workbenchAccounting";
import type { AccountingWorkbench, CreditRow, MatchState } from "@/lib/workbench-accounting";
import { admitManualEvidence } from "./actions";
import {
  BLOCK_CLASS_NAME, BLOCK_HEAD_CLASS_NAME, CHIPS_CLASS_NAME, FORM_ACTIONS_CLASS_NAME, FORM_CLASS_NAME, FORM_GRID_CLASS_NAME,
  FORM_WIDE_CLASS_NAME, PANEL_CLASS_NAME, ROW_ASIDE_CLASS_NAME, ROW_CLASS_NAME, ROW_MAIN_CLASS_NAME,
} from "./classNames";
import { digitsToNumber, formatDay, formatMoney, todayVn } from "./format";

const MATCH_TONE: Record<MatchState, "success" | "warning" | "neutral"> = { matched: "success", unclear: "warning", unmatched: "neutral" };
const INVOICE_TONE = { draft: "neutral", issued: "warning", paid: "success", void: "neutral" } as const;

const sourceLabelKey = (kind: CreditRow["sourceKind"]) =>
  kind === "vietcombank" ? "srcVietcombank" : kind === "manual" ? "srcManual" : kind === "inbox" ? "srcInbox" : "srcOther";

/** The "Ghi nhận thủ công" form: admits one manual piece of evidence through the existing inbound path. */
const ManualForm = ({ onDone }: { readonly onDone: () => void }) => {
  const t = useT(workbenchAccounting);
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState<DateValue | null>(() => parseDate(todayVn()));
  const [content, setContent] = useState("");
  const [payer, setPayer] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await admitManualEvidence({ amount: digitsToNumber(amount) ?? 0, date: date ? date.toString() : todayVn(), content, note, payer }).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "" }));
      if (!res.ok) return setError(res.error);
      if (res.data.duplicate) return setNotice(t("manualDuplicate"));
      router.refresh();
      onDone();
    });
  };

  return (
    <SurfaceCard label={t("manualTitle")}>
      <Form label={t("manualTitle")} isPending={isPending} onSubmit={submit}>
        <div className={FORM_CLASS_NAME}>
          <Text size="sm" tone="muted">{t("manualIntro")}</Text>
          <div className={FORM_GRID_CLASS_NAME}>
            <Input id="wb-acc-amount" name="amount" label={t("fAmount")} variant="secondary" value={amount} isRequired isDisabled={isPending} hint={amount ? formatMoney(digitsToNumber(amount), locale) : undefined} onValueChange={setAmount} />
            <DateField name="date" label={t("fDate")} variant="secondary" isRequired isDisabled={isPending} value={date} maxValue={parseDate(todayVn())} onValueChange={setDate} />
            <div className={FORM_WIDE_CLASS_NAME}>
              <Input id="wb-acc-content" name="content" label={t("fContent")} variant="secondary" value={content} isRequired isDisabled={isPending} hint={t("fContentHint")} onValueChange={setContent} />
            </div>
            <div className={FORM_WIDE_CLASS_NAME}>
              <Input id="wb-acc-payer" name="payer" label={t("fPayer")} variant="secondary" value={payer} isDisabled={isPending} onValueChange={setPayer} />
            </div>
            <div className={FORM_WIDE_CLASS_NAME}>
              <Textarea id="wb-acc-note" name="note" label={t("fNote")} variant="secondary" rows={3} value={note} isDisabled={isPending} onValueChange={setNote} />
            </div>
          </div>
          {error ? <Alert tone="negative" title={error} /> : null}
          {notice ? <Alert tone="cautionary" title={notice} /> : null}
          <div className={FORM_ACTIONS_CLASS_NAME}>
            <Button type="submit" isPending={isPending}>{t("manualSave")}</Button>
            <Button variant="ghost" isDisabled={isPending} onPress={onDone}>{t("cancel")}</Button>
          </div>
          <Text size="xs" tone="muted">{t("manualFoot")}</Text>
        </div>
      </Form>
    </SurfaceCard>
  );
};

/** "Chứng từ": bank credits with match state, invoices with status, orders still without an invoice. */
export const EvidencePanel = ({ data }: { readonly data: AccountingWorkbench }) => {
  const t = useT(workbenchAccounting);
  const locale = useLocale();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const money = (n: number | null) => formatMoney(n, locale);
  return (
    <div className={PANEL_CLASS_NAME}>
      <section className={BLOCK_CLASS_NAME} aria-label={t("creditsTitle")}>
        <div className={BLOCK_HEAD_CLASS_NAME}>
          <SectionHeader level={2} title={t("creditsTitle")} description={t("creditsIntro")} />
          {isFormOpen ? null : <Button onPress={() => setIsFormOpen(true)}>{t("manualOpen")}</Button>}
        </div>
        {isFormOpen ? <ManualForm onDone={() => setIsFormOpen(false)} /> : null}
        <SurfaceListCard ariaLabel={t("creditsTitle")} empty={<EmptyNotice message={t("creditsEmpty")} description={t("creditsEmptyBody")} />}>
            {data.credits.map((c) => (
              <li key={c.id} className={ROW_CLASS_NAME}>
                <div className={ROW_MAIN_CLASS_NAME}>
                  <Text weight="semibold">{c.payer || t("payerUnknown")}</Text>
                  <Text size="sm" tone="muted">{c.reference || t("noReference")}</Text>
                  <div className={CHIPS_CLASS_NAME}>
                    <Text size="xs" tone="muted">{`${formatDay(c.occurredAt, locale)} · ${t(sourceLabelKey(c.sourceKind))}`}</Text>
                    {c.invoiceNo ? <Text size="xs" tone="muted">{t("matchedTo", { no: c.invoiceNo })}</Text> : null}
                    <Badge tone="neutral">{c.origin === "simulated" ? t("originSimulated") : t("originLive")}</Badge>
                  </div>
                </div>
                <div className={ROW_ASIDE_CLASS_NAME}>
                  <Text weight="semibold">{money(c.amount)}</Text>
                  <Badge tone={MATCH_TONE[c.match]} isDot>{t(`match_${c.match}`)}</Badge>
                </div>
              </li>
            ))}
        </SurfaceListCard>
      </section>

      <section className={BLOCK_CLASS_NAME} aria-label={t("invoicesTitle")}>
        <SectionHeader level={2} title={t("invoicesTitle")} description={t("invoicesIntro")} />
        <SurfaceListCard ariaLabel={t("invoicesTitle")} empty={<EmptyNotice message={t("invoicesEmpty")} description={t("invoicesEmptyBody")} />}>
            {data.invoices.map((i) => (
              <li key={i.id} className={ROW_CLASS_NAME}>
                <div className={ROW_MAIN_CLASS_NAME}>
                  <Text weight="semibold">{i.invoiceNo}</Text>
                  <Text size="sm" tone="muted">{[i.customer, i.orderNo ? t("fromOrder", { no: i.orderNo }) : null].filter(Boolean).join(" · ") || "—"}</Text>
                  <div className={CHIPS_CLASS_NAME}>
                    <Text size="xs" tone="muted">{i.status === "paid" ? t("paidOn", { date: formatDay(i.paidAt, locale) }) : i.dueAt ? t("dueOn", { date: formatDay(i.dueAt, locale) }) : t("issuedOn", { date: formatDay(i.issuedAt ?? i.createdAt, locale) })}</Text>
                    <Badge tone="neutral">{i.origin === "simulated" ? t("originSimulated") : t("originLive")}</Badge>
                  </div>
                </div>
                <div className={ROW_ASIDE_CLASS_NAME}>
                  <Text weight="semibold">{money(i.amount)}</Text>
                  <Badge tone={INVOICE_TONE[i.status]} isDot>{t(`invoice_${i.status}`)}</Badge>
                </div>
              </li>
            ))}
        </SurfaceListCard>
        <Text size="xs" tone="muted">{t("internalNote")}</Text>
      </section>

      <section className={BLOCK_CLASS_NAME} aria-label={t("ordersTitle")}>
        <SectionHeader level={2} title={t("ordersTitle")} description={t("ordersIntro")} />
        <SurfaceListCard ariaLabel={t("ordersTitle")} empty={<EmptyNotice message={t("ordersEmpty")} description={t("ordersEmptyBody")} />}>
            {data.ordersWithoutInvoice.map((o) => (
              <li key={o.id} className={ROW_CLASS_NAME}>
                <div className={ROW_MAIN_CLASS_NAME}>
                  <Text weight="semibold">{o.orderNo}</Text>
                  <Text size="sm" tone="muted">{[o.customer, o.items].filter(Boolean).join(" · ") || "—"}</Text>
                  <Text size="xs" tone="muted">{formatDay(o.createdAt, locale)}</Text>
                </div>
                <div className={ROW_ASIDE_CLASS_NAME}>
                  <Text weight="semibold">{o.amount === null ? t("noAmount") : money(o.amount)}</Text>
                  <Badge tone="warning" isDot>{t("noInvoiceYet")}</Badge>
                </div>
              </li>
            ))}
        </SurfaceListCard>
      </section>
    </div>
  );
};
