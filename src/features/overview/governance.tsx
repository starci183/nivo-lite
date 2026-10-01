"use client";

import Link from "next/link";
import { Badge, SectionHeader, SurfaceCard, Text, TextAction } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { intlLocale } from "@/i18n/core";
import { governance as governanceDict } from "@/i18n/dict/governance";
import { overview } from "@/i18n/dict/overview";
import type { Department, ReasonCode, WorkItemView } from "@/lib/flow-types";
import type { GovernanceWithStatus, OriginSplit } from "@/lib/flow-queries";
import {
  BLOCK_CLASS_NAME,
  CHIP_ROW_CLASS_NAME,
  DEPT_GRID_CLASS_NAME,
  DEPT_TILE_CLASS_NAME,
  GOAL_LINE_CLASS_NAME,
  STACK_CLASS_NAME,
  STATUS_CELL_CLASS_NAME,
  STATUS_LABEL_CLASS_NAME,
  STATUS_LIST_CLASS_NAME,
  STATUS_ROW_CLASS_NAME,
  STATUS_SPLIT_CLASS_NAME,
  WAIT_ROW_CLASS_NAME,
} from "./classNames";

/** Props for {@link GovernanceBlocks}. `governance` is null when the flow data could not be read. */
export type GovernanceBlocksProps = {
  readonly governance: GovernanceWithStatus | null;
  /** Work items waiting for a decision, oldest first (test runs already removed). */
  readonly waiting: ReadonlyArray<WorkItemView>;
};

const DEPARTMENT_ORDER: ReadonlyArray<Department> = ["chatbot", "sales", "accounting"];
const EXCEPTION_ORDER: ReadonlyArray<ReasonCode> = ["missing_data", "over_authority", "unclear_outcome", "not_allowed"];
const TOP_WAITING = 3;

const outcomeTone = (outcome: string): "success" | "accent" | "warning" | "danger" =>
  outcome === "auto_done" ? "success" : outcome === "approved" ? "accent" : outcome === "edited" ? "warning" : "danger";

type StatusRowProps = {
  readonly label: string;
  readonly context: string;
  /** Money (VND) when `money`, otherwise the same record counts as `count`. */
  readonly split: OriginSplit;
  readonly count: OriginSplit;
  readonly unit: "countOrders" | "countRecords" | "countPayments" | "countLeads";
  readonly money?: boolean;
};

/** One status: what it is and what it rests on, then live and simulated side by side (never added together). */
const StatusRow = ({ label, context, split, count, unit, money = false }: StatusRowProps) => {
  const t = useT(overview);
  const locale = useLocale();
  const number = new Intl.NumberFormat(intlLocale(locale));
  const value = (n: number) => (money ? `${number.format(n)} ${locale === "vi" ? "₫" : "VND"}` : number.format(n));
  const cell = (origin: string, key: keyof OriginSplit) => (
    <div className={STATUS_CELL_CLASS_NAME}>
      <Text size="xs" tone="muted">{origin}</Text>
      <Text weight="semibold" tone={key === "live" ? undefined : "muted"}>{value(split[key])}</Text>
      {money ? <Text size="xs" tone="muted">{t(unit, { n: number.format(count[key]) })}</Text> : null}
    </div>
  );
  return (
    <div className={STATUS_ROW_CLASS_NAME}>
      <div className={STATUS_LABEL_CLASS_NAME}>
        <Text size="sm" weight="semibold">{label}</Text>
        <Text size="xs" tone="muted">{context}</Text>
        {split.unlabelled > 0 ? <Text size="xs" tone="muted">{`${t("resultsUnlabelled")}: ${value(split.unlabelled)}`}</Text> : null}
      </div>
      <div className={STATUS_SPLIT_CLASS_NAME}>
        {cell(t("resultsLive"), "live")}
        {cell(t("resultsSim"), "simulated")}
      </div>
    </div>
  );
};

/** The five governance blocks of the operating flow: overview, results by status, waiting, exceptions, decision history. */
export const GovernanceBlocks = ({ governance, waiting }: GovernanceBlocksProps) => {
  const t = useT(overview);
  const g = useT(governanceDict);
  const locale = useLocale();
  const tag = intlLocale(locale);
  const number = new Intl.NumberFormat(tag);
  const vnd = (n: number) => `${number.format(n)} ${locale === "vi" ? "₫" : "VND"}`;
  // Relative like the rest of the console ("5 phút trước"); the exact time stays in the tooltip.
  const exact = (iso: string) => new Intl.DateTimeFormat(tag, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(iso));
  const time = (iso: string) => {
    const secs = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
    const rtf = new Intl.RelativeTimeFormat(tag, { numeric: "auto" });
    const abs = Math.abs(secs);
    if (abs < 60) return rtf.format(0, "minute");
    if (abs < 3600) return rtf.format(Math.round(secs / 60), "minute");
    if (abs < 86_400) return rtf.format(Math.round(secs / 3600), "hour");
    if (abs < 7 * 86_400) return rtf.format(Math.round(secs / 86_400), "day");
    return exact(iso);
  };

  if (governance === null) {
    return (
      <SurfaceCard ariaLabel={t("resultsTitle")}>
        <Text tone="muted">{t("govUnavailable")}</Text>
      </SurfaceCard>
    );
  }

  const { goals, status, efficiency, departments, exceptions, recentDecisions, pendingDecisions } = governance;
  const exceptionTotal = EXCEPTION_ORDER.reduce((sum, key) => sum + exceptions[key], 0) + exceptions.failed;
  const noGoalLink = <TextAction href="/authority">{t("goalSet")}</TextAction>;

  return (
    <div className={STACK_CLASS_NAME}>
      {/* 1. Overview */}
      <section className={BLOCK_CLASS_NAME} aria-label={t("sumTitle")}>
        <SectionHeader level={2} title={t("sumTitle")} description={t("motto")} />
        <SurfaceCard ariaLabel={t("sumTitle")}>
          <div className={STACK_CLASS_NAME}>
            <Text weight="semibold">{t("sumSentence", { done: efficiency.autoDone7d, asked: efficiency.askedHuman7d })}</Text>
            <Text size="sm" tone="muted">
              {efficiency.medianDecisionMinutes === null ? t("sumMedianNone") : t("sumMedian", { n: Math.round(efficiency.medianDecisionMinutes) })}
            </Text>
            <div className={DEPT_GRID_CLASS_NAME}>
              {DEPARTMENT_ORDER.map((key) => {
                const d = departments.find((item) => item.department === key);
                return (
                  <Link key={key} href="/chat" className={DEPT_TILE_CLASS_NAME}>
                    <Text weight="semibold">{g(`dept_${key}`)}</Text>
                    <Text size="sm">{t("deptDone", { n: d?.done7d ?? 0 })}</Text>
                    <Text size="sm" tone={d && d.waiting > 0 ? "accent" : "muted"}>{t("deptWaiting", { n: d?.waiting ?? 0 })}</Text>
                    <Text size="xs" tone="muted">{d?.lastActivityAt ? t("deptLast", { time: time(d.lastActivityAt) }) : t("deptNoActivity")}</Text>
                  </Link>
                );
              })}
            </div>
          </div>
        </SurfaceCard>
      </section>

      {/* 2. Results by status: each figure names its status and evidence; live and simulated never summed. */}
      <section className={BLOCK_CLASS_NAME} aria-label={t("resultsTitle")}>
        <SectionHeader level={2} title={t("resultsTitle")} description={t("resultsIntro")} />
        <SurfaceCard ariaLabel={t("resultsTitle")}>
          <div className={STACK_CLASS_NAME}>
            <div className={STATUS_LIST_CLASS_NAME}>
              <StatusRow label={t("resultsConfirmed")} context={t("resultsConfirmedCtx")} split={status.confirmedOrders.vnd} count={status.confirmedOrders.count} unit="countOrders" money />
              <StatusRow label={t("resultsInvoiced")} context={t("resultsInvoicedCtx")} split={status.internalInvoices.vnd} count={status.internalInvoices.count} unit="countRecords" money />
              <StatusRow label={t("resultsCollected")} context={t("resultsCollectedCtx")} split={status.matchedPayments.vnd} count={status.matchedPayments.count} unit="countPayments" money />
              <StatusRow label={t("resultsPending")} context={t("resultsPendingCtx")} split={status.pendingVerification.vnd} count={status.pendingVerification.count} unit="countPayments" money />
              <StatusRow label={t("resultsNew")} context={t("resultsNewCtx")} split={status.newLeads7d} count={status.newLeads7d} unit="countLeads" />
              <StatusRow label={t("resultsWon")} context={t("resultsWonCtx")} split={status.wonLeads} count={status.wonLeads} unit="countLeads" />
            </div>
            <Text size="sm" tone="muted">{t("resultsService")}</Text>
            <div className={GOAL_LINE_CLASS_NAME}>
              {goals.revenueVnd !== null ? (
                <Text size="sm">{t("goalRevenue", { value: vnd(status.matchedPayments.vnd.live), goal: vnd(goals.revenueVnd) })}</Text>
              ) : (
                <Text size="sm" tone="muted">{t("goalRevenueNone")}</Text>
              )}
              {goals.revenueVnd === null ? noGoalLink : null}
            </div>
            <div className={GOAL_LINE_CLASS_NAME}>
              {goals.newCustomers !== null ? (
                <Text size="sm">{t("goalCustomers", { value: number.format(status.newLeads7d.live), goal: number.format(goals.newCustomers) })}</Text>
              ) : (
                <Text size="sm" tone="muted">{t("goalCustomersNone")}</Text>
              )}
              {goals.newCustomers === null ? noGoalLink : null}
            </div>
            <Text size="xs" tone="muted">
              {status.excludedTestRecords > 0 ? t("resultsTestExcluded", { n: number.format(status.excludedTestRecords) }) : t("resultsTestNone")}
            </Text>
          </div>
        </SurfaceCard>
      </section>

      {/* 3. Waiting */}
      <section className={BLOCK_CLASS_NAME} aria-label={t("waitingTitle")}>
        <SectionHeader
          level={2}
          title={t("waitingTitle")}
          action={pendingDecisions > 0 ? <TextAction href="/chat" appearance="section">{t("waitingOpen")}</TextAction> : undefined}
        />
        <SurfaceCard ariaLabel={t("waitingTitle")}>
          <div className={STACK_CLASS_NAME}>
            {pendingDecisions === 0 ? (
              <Text tone="muted">{t("waitingNone")}</Text>
            ) : (
              <>
                <Text weight="semibold">{pendingDecisions === 1 ? t("waitingCountOne") : t("waitingCount", { n: pendingDecisions })}</Text>
                {waiting.slice(0, TOP_WAITING).map((item) => (
                  <Link key={item.id} href="/chat" className={WAIT_ROW_CLASS_NAME}>
                    <div className={CHIP_ROW_CLASS_NAME}>
                      <Badge tone="neutral">{g(`dept_${item.department}`)}</Badge>
                      {item.reason ? <Badge tone="warning">{g(`reason_${item.reason}`)}</Badge> : null}
                      {item.origin === "simulated" ? <Badge tone="neutral">{g("origin_simulated")}</Badge> : null}
                    </div>
                    <Text size="sm" weight="medium">{g(`action_${item.action}`)}{item.lead ? ` · ${item.lead.contact_name}` : ""}</Text>
                    {item.proposal.summary ? <Text size="sm" tone="muted" overflow="clamp-2">{item.proposal.summary}</Text> : null}
                  </Link>
                ))}
                {pendingDecisions > TOP_WAITING ? <Text size="sm" tone="muted">{t("waitingMore", { n: pendingDecisions })}</Text> : null}
              </>
            )}
            <Text size="xs" tone="muted">{t("waitingSource")}</Text>
          </div>
        </SurfaceCard>
      </section>

      {/* 4. Exceptions */}
      <section className={BLOCK_CLASS_NAME} aria-label={t("exceptionsTitle")}>
        <SectionHeader level={2} title={t("exceptionsTitle")} />
        <SurfaceCard ariaLabel={t("exceptionsTitle")}>
          <div className={STACK_CLASS_NAME}>
            {exceptionTotal === 0 ? (
              <Text tone="muted">{t("exceptionsNone")}</Text>
            ) : (
              <>
                <Text weight="semibold">{t("exceptionsTotal", { n: exceptionTotal })}</Text>
                <div className={CHIP_ROW_CLASS_NAME}>
                  {EXCEPTION_ORDER.filter((key) => exceptions[key] > 0).map((key) => (
                    <Badge key={key} tone="warning">{`${g(`reason_${key}`)} · ${exceptions[key]}`}</Badge>
                  ))}
                  {exceptions.failed > 0 ? <Badge tone="danger">{`${t("exceptionsFailed")} · ${exceptions.failed}`}</Badge> : null}
                </div>
              </>
            )}
            <Text size="xs" tone="muted">{t("exceptionsSource")}</Text>
          </div>
        </SurfaceCard>
      </section>

      {/* 5. Decision history */}
      <section className={BLOCK_CLASS_NAME} aria-label={t("historyTitle")}>
        <SectionHeader level={2} title={t("historyTitle")} action={<TextAction href="/decisions" appearance="section">{t("historyAll")}</TextAction>} />
        <SurfaceCard ariaLabel={t("historyTitle")}>
          <div className={STACK_CLASS_NAME}>
            {recentDecisions.length === 0 ? (
              <Text tone="muted">{t("historyEmpty")}</Text>
            ) : (
              recentDecisions.slice(0, 5).map((row) => (
                <div key={row.id} className={WAIT_ROW_CLASS_NAME}>
                  <div className={CHIP_ROW_CLASS_NAME}>
                    <Text size="sm" weight="semibold">{g(`action_${row.action}`)}</Text>
                    <Badge tone={outcomeTone(row.outcome)}>{g(`outcome_${row.outcome}`)}</Badge>
                    <span title={exact(row.created_at)}><Text size="xs" tone="muted">{time(row.created_at)}</Text></span>
                  </div>
                  <Text size="sm" tone="muted">
                    {`${g(`dept_${row.department}`)} · ${row.decider_kind === "policy" ? g("decider_policy") : row.decided_by}${row.leadName ? ` · ${row.leadName}` : ""}`}
                  </Text>
                </div>
              ))
            )}
            <Text size="xs" tone="muted">{t("historySource")}</Text>
          </div>
        </SurfaceCard>
      </section>
    </div>
  );
};
