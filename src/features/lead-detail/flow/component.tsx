"use client";

import { Badge, EmptyNotice, SurfaceCard, Text } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { governance } from "@/i18n/dict/governance";
import { lead as leadDict } from "@/i18n/dict/lead";
import type { LeadFlow } from "@/lib/flow-types";
import { ITEM, ITEM_HEAD, ITEM_META, LIST, SECTION, STACK } from "./classNames";
import { formatDay, formatVnd, formatWhen } from "./format";

type FlowViewProps = { readonly flow: LeadFlow | null };

/** "Work flow" panel: this lead's AI work items in order, plus orders, invoices, payments and decisions. */
export const FlowView = (props: FlowViewProps) => {
  const t = useT(leadDict);
  const g = useT(governance);
  const locale = useLocale();
  const { flow } = props;
  if (flow === null) {
    return (
      <SurfaceCard label={t("flowTitle")}>
        <EmptyNotice message={t("flowUnavailable")} description={t("flowUnavailableHint")} />
      </SurfaceCard>
    );
  }
  const { workItems, orders, invoices, transactions, decisions } = flow;
  const ordered = [...workItems].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const hasSimulated = ordered.some((item) => item.origin === "simulated") || orders.some((order) => order.origin === "simulated");
  const orderNo = new Map(orders.map((order) => [order.id, order.order_no]));

  return (
    <SurfaceCard label={t("flowTitle")} fact={t("flowFact", { count: ordered.length })}>
      <div className={STACK} data-testid="lead-flow">
        {hasSimulated ? (
          <div className={ITEM_META}>
            <Badge tone="neutral">{g("origin_simulated")}</Badge>
            <Text as="span" size="xs" tone="muted">{t("flowSimulatedNote")}</Text>
          </div>
        ) : null}

        <div className={SECTION}>
          <Text as="p" size="sm" weight="semibold">{t("flowSteps")}</Text>
          {ordered.length === 0 ? (
            <EmptyNotice message={t("flowNoSteps")} description={t("flowNoStepsHint")} />
          ) : (
            <ol className={LIST} aria-label={t("flowSteps")}>
              {ordered.map((item) => {
                const line = [g(`dept_${item.department}`), g(`action_${item.action}`), g(`status_${item.status}`), item.decided_path ? g(`path_${item.decided_path}`) : null].filter(Boolean).join(" · ");
                const tone = item.status === "done" ? "success" : item.status === "waiting_decision" ? "warning" : item.status === "failed" || item.status === "rejected" ? "danger" : "neutral";
                const summary = item.result?.summary ?? item.proposal?.summary ?? null;
                return (
                  <li key={item.id} className={ITEM} data-testid="flow-work-item" data-status={item.status} data-action={item.action}>
                    <div className={ITEM_HEAD}>
                      <Text as="span" size="sm" weight="medium">{line}</Text>
                      <Text as="span" size="xs" tone="muted"><time dateTime={item.created_at}>{formatWhen(item.created_at, locale)}</time></Text>
                    </div>
                    <div className={ITEM_META}>
                      <Badge tone={tone}>{g(`status_${item.status}`)}</Badge>
                      {item.reason ? <Badge tone="neutral">{g(`reason_${item.reason}`)}</Badge> : null}
                    </div>
                    <Text as="p" size="xs" tone="muted">
                      {[g(`evidence_${item.evidence_state}`), item.origin === "simulated" ? g("origin_simulated") : null].filter(Boolean).join(" · ")}
                    </Text>
                    {summary ? <Text as="p" size="sm">{summary}</Text> : null}
                    {item.error ? <Text as="p" size="xs" tone="muted">{`${t("flowError")}: ${item.error}`}</Text> : null}
                    {item.assignedStaffName ? <Text as="p" size="xs" tone="muted">{t("flowAssignedTo", { name: item.assignedStaffName })}</Text> : null}
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className={SECTION}>
          <Text as="p" size="sm" weight="semibold">{t("flowOrders")}</Text>
          {orders.length === 0 ? <Text as="p" size="xs" tone="muted">{t("flowNone")}</Text> : (
            <ul className={LIST} aria-label={t("flowOrders")}>
              {orders.map((order) => (
                <li key={order.id} className={ITEM} data-testid="flow-order" data-status={order.status}>
                  <div className={ITEM_HEAD}>
                    <Text as="span" size="sm" weight="medium">{`${order.order_no} · ${formatVnd(order.amount_vnd, locale)}`}</Text>
                    <Badge tone={order.status === "cancelled" ? "danger" : order.status === "draft" ? "neutral" : "success"}>{g(`order_${order.status}`)}</Badge>
                  </div>
                  {order.items ? <Text as="p" size="xs" tone="muted">{order.items}</Text> : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={SECTION}>
          <Text as="p" size="sm" weight="semibold">{t("flowInvoices")}</Text>
          {invoices.length === 0 ? <Text as="p" size="xs" tone="muted">{t("flowNone")}</Text> : (
            <ul className={LIST} aria-label={t("flowInvoices")}>
              {invoices.map((invoice) => (
                <li key={invoice.id} className={ITEM} data-testid="flow-invoice" data-status={invoice.status}>
                  <div className={ITEM_HEAD}>
                    <Text as="span" size="sm" weight="medium">{`${invoice.invoice_no} · ${formatVnd(invoice.amount_vnd, locale)}`}</Text>
                    <Badge tone={invoice.status === "paid" ? "success" : invoice.status === "void" ? "danger" : "neutral"}>{g(`invoice_${invoice.status}`)}</Badge>
                  </div>
                  <Text as="p" size="xs" tone="muted">
                    {[
                      invoice.order_id ? (orderNo.get(invoice.order_id) ?? null) : null,
                      invoice.issued_by ? t("flowInvoiceBy", { name: invoice.issued_by }) : null,
                      invoice.due_at ? t("flowDueOn", { date: formatDay(invoice.due_at, locale) }) : null,
                      invoice.paid_at ? t("flowPaidOn", { date: formatDay(invoice.paid_at, locale) }) : null,
                      g("internalInvoice"),
                    ].filter(Boolean).join(" · ")}
                  </Text>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={SECTION}>
          <Text as="p" size="sm" weight="semibold">{t("flowPayments")}</Text>
          {transactions.length === 0 ? <Text as="p" size="xs" tone="muted">{t("flowNone")}</Text> : (
            <ul className={LIST} aria-label={t("flowPayments")}>
              {transactions.map((tx) => (
                <li key={tx.id} className={ITEM} data-testid="flow-transaction" data-status={tx.status}>
                  <div className={ITEM_HEAD}>
                    <Text as="span" size="sm" weight="medium">{`${formatVnd(tx.amount_vnd, locale)} · ${tx.payer ?? g("channel_bank")}`}</Text>
                    <Badge tone={tx.status === "matched" ? "success" : "warning"}>{g(`tx_${tx.status}`)}</Badge>
                  </div>
                  <Text as="p" size="xs" tone="muted">{[tx.reference ? t("flowUnmatchedRef", { ref: tx.reference }) : null, formatWhen(tx.occurred_at, locale)].filter(Boolean).join(" · ")}</Text>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={SECTION}>
          <Text as="p" size="sm" weight="semibold">{t("flowDecisions")}</Text>
          {decisions.length === 0 ? <Text as="p" size="xs" tone="muted">{t("flowNone")}</Text> : (
            <ul className={LIST} aria-label={t("flowDecisions")}>
              {decisions.map((decision) => (
                <li key={decision.id} className={ITEM} data-testid="flow-decision" data-outcome={decision.outcome}>
                  <div className={ITEM_HEAD}>
                    <Text as="span" size="sm" weight="medium">{`${g(`dept_${decision.department}`)} · ${g(`action_${decision.action}`)}`}</Text>
                    <Badge tone={decision.outcome === "rejected" ? "danger" : decision.outcome === "auto_done" ? "neutral" : "success"}>{g(`outcome_${decision.outcome}`)}</Badge>
                  </div>
                  <Text as="p" size="xs" tone="muted">
                    {t("flowDecidedBy", { name: decision.decider_kind === "policy" ? g("decider_policy") : decision.decided_by, time: formatWhen(decision.created_at, locale) })}
                  </Text>
                  {decision.reason ? <Text as="p" size="xs" tone="muted">{`${t("flowGate")}: ${g(`reason_${decision.reason}`)}`}</Text> : null}
                  {decision.note ? <Text as="p" size="sm">{decision.note}</Text> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </SurfaceCard>
  );
};
