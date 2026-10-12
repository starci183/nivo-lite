"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Badge, Button, Drawer, EmptyNotice, Form, Input, ListRow, Select, SurfaceListCard, Text, Textarea, type BadgeTone } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { workbenchSales } from "@/i18n/dict/workbenchSales";
import { CONTRACT_STATUSES, dayText, daysLeft, type Contract, type ContractStatus } from "@/lib/sales-contracts-shared";
import { saveContract } from "./actions";
import { FORM_CLASS_NAME } from "./classNames";
import { formatVnd, parseAmount } from "./format";

const STATUS_TONE: Record<ContractStatus, BadgeTone> = { active: "success", ended: "neutral", cancelled: "danger" };
const NO_LEAD = "none";
const VN_OFFSET_MS = 7 * 3_600_000;

/** Props for {@link ContractsPanel}. */
export type ContractsPanelProps = {
  readonly contracts: ReadonlyArray<Contract>;
  readonly leads: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  /** The server's clock, so server and browser agree on "today". */
  readonly nowIso: string;
};

type DrawerProps = {
  readonly editing: Contract | null;
  readonly leads: ContractsPanelProps["leads"];
  readonly today: string;
  readonly onClose: (message?: string) => void;
};

/** Add or edit a recurring contract. Dates are typed as YYYY-MM-DD (the server validates them). */
const ContractDrawer = ({ editing, leads, today, onClose }: DrawerProps) => {
  const t = useT(workbenchSales);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState(() => ({
    leadId: editing?.lead_id ?? NO_LEAD,
    customerName: editing?.customer_name ?? "",
    plan: editing?.plan ?? "",
    startsOn: editing?.starts_on ?? today,
    endsOn: editing?.ends_on ?? "",
    amount: editing?.amount_vnd != null ? String(editing.amount_vnd) : "",
    status: (editing?.status ?? "active") as ContractStatus,
    note: editing?.note ?? "",
  }));
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const pickLead = (id: string) => {
    setF((p) => ({ ...p, leadId: id, customerName: id !== NO_LEAD && !p.customerName.trim() ? (leads.find((l) => l.id === id)?.name.split(" · ")[0] ?? "") : p.customerName }));
  };

  const submit = () => startTransition(async () => {
    setError(null);
    const r = await saveContract({
      ...(editing ? { id: editing.id } : {}), leadId: f.leadId === NO_LEAD ? null : f.leadId, customerName: f.customerName, plan: f.plan,
      startsOn: f.startsOn, endsOn: f.endsOn, amountVnd: parseAmount(f.amount), status: f.status, note: f.note,
    }).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "" }));
    if (!r.ok) return setError(t("actionFailed", { error: r.error }));
    router.refresh();
    onClose(t("contractSaved"));
  });

  const title = editing ? t("contractEditTitle") : t("contractAddTitle");
  return (
    <Drawer isOpen onOpenChange={(o) => { if (!o) onClose(); }} title={title} closeLabel={t("cancel")} placement="right"
      footer={(close) => (
        <>
          <Button variant="primary" isPending={isPending} isDisabled={!f.customerName.trim() || !f.endsOn.trim()} onPress={submit}>{t("save")}</Button>
          <Button variant="ghost" onPress={close}>{t("cancel")}</Button>
        </>
      )}
    >
      <Form label={title} onSubmit={submit} isPending={isPending}>
        <div className={FORM_CLASS_NAME}>
          {error ? <Alert tone="negative" title={error} /> : null}
          <Select label={t("contractLead")} value={f.leadId} variant="secondary"
            options={[{ id: NO_LEAD, label: t("contractLeadNone") }, ...leads.map((l) => ({ id: l.id, label: l.name }))]} onValueChange={(v) => pickLead(v ?? NO_LEAD)} />
          <Input id="contract-customer" name="customer" label={t("contractCustomer")} variant="secondary" value={f.customerName} onValueChange={(v) => set("customerName", v)} isRequired />
          <Input id="contract-plan" name="plan" label={t("contractPlan")} hint={t("contractPlanHint")} variant="secondary" value={f.plan} onValueChange={(v) => set("plan", v)} />
          <Input id="contract-start" name="startsOn" label={t("contractStart")} variant="secondary" placeholder="2026-11-01" value={f.startsOn} onValueChange={(v) => set("startsOn", v)} isRequired />
          <Input id="contract-end" name="endsOn" label={t("contractEnd")} hint={t("contractEndHint")} variant="secondary" placeholder="2027-10-31" value={f.endsOn} onValueChange={(v) => set("endsOn", v)} isRequired />
          <Input id="contract-amount" name="amount" label={t("contractAmount")} variant="secondary" value={f.amount} onValueChange={(v) => set("amount", v)} />
          <Select label={t("contractStatus")} value={f.status} variant="secondary"
            options={CONTRACT_STATUSES.map((s) => ({ id: s, label: t(`contractStatus_${s}`) }))} onValueChange={(v) => set("status", CONTRACT_STATUSES.find((s) => s === v) ?? "active")} />
          <Textarea id="contract-note" label={t("contractNote")} variant="secondary" rows={2} value={f.note} onValueChange={(v) => set("note", v)} />
        </div>
      </Form>
    </Drawer>
  );
};

/** Surface 5: recurring contracts. The renewal automation reminds the customer (and sales) a number of days before the end date. */
export const ContractsPanel = ({ contracts, leads, nowIso }: ContractsPanelProps) => {
  const t = useT(workbenchSales);
  const locale = useLocale();
  const [drawer, setDrawer] = useState<{ editing: Contract | null } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const today = new Date(Date.parse(nowIso) + VN_OFFSET_MS).toISOString().slice(0, 10);

  const when = (c: Contract): { readonly text: string; readonly tone: BadgeTone } | null => {
    if (c.status !== "active") return null;
    const left = daysLeft(c.ends_on, today);
    if (left < 0) return { text: t("contractOverdue", { n: -left }), tone: "danger" };
    if (left === 0) return { text: t("contractToday"), tone: "warning" };
    return { text: t("contractInDays", { n: left }), tone: left <= 14 ? "warning" : "neutral" };
  };

  return (
    <>
      <Text size="sm" tone="muted">{t("contractsIntro")}</Text>
      <div>
        <Button variant="primary" size="sm" onPress={() => setDrawer({ editing: null })}>{t("contractAdd")}</Button>
      </div>
      {note ? <Text size="sm" weight="medium" live="polite">{note}</Text> : null}
      <SurfaceListCard ariaLabel={t("tab_contracts")} empty={<EmptyNotice message={t("contractsEmptyTitle")} description={t("contractsEmptyBody")} />}>
        {contracts.map((c) => {
          const w = when(c);
          return (
            <ListRow
              key={c.id}
              title={c.customer_name}
              description={[c.plan, `${dayText(c.starts_on)} - ${dayText(c.ends_on)}`, c.amount_vnd != null ? formatVnd(c.amount_vnd, locale) : ""].filter(Boolean).join(" · ")}
              badges={<><Badge tone={STATUS_TONE[c.status]} isDot>{t(`contractStatus_${c.status}`)}</Badge>{w ? <Badge tone={w.tone}>{w.text}</Badge> : null}</>}
              actions={<Button variant="outline" size="sm" onPress={() => setDrawer({ editing: c })}>{t("contractEdit")}</Button>}
            />
          );
        })}
      </SurfaceListCard>
      {drawer ? <ContractDrawer key={drawer.editing?.id ?? "new"} editing={drawer.editing} leads={leads} today={today} onClose={(m) => { setDrawer(null); if (m) setNote(m); }} /> : null}
    </>
  );
};
