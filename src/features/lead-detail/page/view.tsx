"use client";

import type { ReactNode } from "react";
import { PageContainer, PrimaryRailLayout } from "@starci/grammar/common";
import { ContextPanel } from "@/features/lead-detail/context";
import { ExecutionPanel } from "@/features/lead-detail/execution";
import { FlowView } from "@/features/lead-detail/flow/component";
import { HistoryPanel, OutcomePanel } from "@/features/lead-detail/outcome";
import { ResponsibilityBase } from "@/features/lead-detail/responsibility/component";
import { channelKeyOf } from "@/features/leads-list/stage";
import { useLocale, useT } from "@/i18n/client";
import { leads } from "@/i18n/dict/leads";
import type { LeadDetail } from "@/lib/types";
import { ANCHOR_CLASS_NAME, PAGE_CLASS_NAME, PRIMARY_CLASS_NAME, RAIL_CLASS_NAME } from "./classNames";
import { formatCaptured, STAGE_KEY, STAGE_TONE } from "./format";
import { LeadHeader } from "./header";
import { primaryActionOf } from "./journey";

/** Props for {@link LeadPageView}. */
export type LeadPageViewProps = {
  /** The lead's detail; null while it loads. */
  readonly detail: LeadDetail | null;
  /** The work-flow panel, read on the server for this lead (unused while loading). */
  readonly flow?: ReactNode;
  /** The responsibility panel, read on the server for this lead (unused while loading). */
  readonly responsibility?: ReactNode;
  /** The "waiting" nudge for this lead (unused while loading). */
  readonly nudge?: ReactNode;
  /** STATE-8: the same page while the lead loads - trail, card labels and section titles stay, every value is a skeleton. */
  readonly isLoading?: boolean;
};

/** Lead journey page: context, responsibility, execution, outcome and history. */
export const LeadPageView = ({ detail, flow, responsibility, nudge, isLoading = false }: LeadPageViewProps) => {
  const t = useT(leads);
  const locale = useLocale();
  const lead = detail?.lead ?? null;
  const loading = isLoading || detail === null || lead === null;
  const channelKey = lead ? channelKeyOf(lead.channel) : null;

  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS_NAME}>
        <LeadHeader
          isLoading={loading}
          leadId={lead?.id ?? ""}
          name={lead?.contact_name ?? ""}
          meta={lead ? t("metaLine", { company: lead.company, channel: channelKey ? t(channelKey) : lead.channel, time: formatCaptured(lead.created_at, locale) }) : ""}
          stageLabel={lead ? t(STAGE_KEY[lead.stage]) : ""}
          stageTone={lead ? STAGE_TONE[lead.stage] : "neutral"}
          primary={detail ? primaryActionOf(detail) : { kind: "none" }}
        />
        <PrimaryRailLayout
          railWidth="standard"
          align="start"
          primary={
            <div className={PRIMARY_CLASS_NAME}>
              <div id="execution" className={ANCHOR_CLASS_NAME}><ExecutionPanel detail={detail} isLoading={loading} /></div>
              <div id="flow" className={ANCHOR_CLASS_NAME}>{loading ? <FlowView flow={null} isLoading /> : flow}</div>
              <HistoryPanel detail={detail} isLoading={loading} />
              {loading ? null : nudge}
            </div>
          }
          rail={
            <div className={RAIL_CLASS_NAME}>
              <div id="responsibility" className={ANCHOR_CLASS_NAME}>{loading ? <ResponsibilityBase isLoading /> : responsibility}</div>
              <div id="context" className={ANCHOR_CLASS_NAME}><ContextPanel detail={detail} isLoading={loading} /></div>
              <div id="outcome" className={ANCHOR_CLASS_NAME}><OutcomePanel detail={detail} isLoading={loading} /></div>
            </div>
          }
        />
      </div>
    </PageContainer>
  );
};
