"use client";

import { EmptyNotice, Icon, Meter, Stepper, SurfaceCard, Text } from "@starci/grammar/common";
import { nivoIconSource } from "@/ui";
import { useLocale, useT } from "@/i18n/client";
import { common } from "@/i18n/dict/common";
import { lead as leadDict } from "@/i18n/dict/lead";
import type { LeadDetail } from "@/lib/types";
import { EVIDENCE_HEAD, EVIDENCE_ITEM, EVIDENCE_STACK, HISTORY_ANCHOR, STACK } from "./classNames";
import { stageLabel, toEventViews } from "./format";
import { HistoryList } from "./HistoryList";
import { OutcomeForm } from "./OutcomeForm";

type PanelProps = { detail: LeadDetail };


const EVIDENCE_KINDS = new Set(["outcome.recorded", "execution.approved"]);

/** Outcome card: stage progression, record-outcome form and evidence already recorded. */
export const OutcomePanel = (props: PanelProps) => {
  const { lead, events } = props.detail;
  const t = useT(leadDict);
  const tc = useT(common);
  const locale = useLocale();
  const ladder = [t("evPending"), t("evCaptured"), t("evReviewed"), t("evVerified"), t("evCustomerConfirmed")];
  const evidence = toEventViews(events, Date.now(), t, locale).filter((event) => EVIDENCE_KINDS.has(event.kind) && event.evidence);
  const evidenceStep = evidence.length === 0 ? 1 : 2;
  const isClosed = lead.stage === "won" || lead.stage === "lost";
  const steps = [
    { id: "new", label: stageLabel("new", tc) },
    { id: "qualified", label: stageLabel("qualified", tc) },
    { id: "proposal", label: stageLabel("proposal", tc) },
    {
      id: "closed",
      label: isClosed ? stageLabel(lead.stage, tc) : t("wonOrLost"),
      ...(lead.stage === "lost" ? { state: "error" as const } : {}),
    },
  ];
  const currentStepId = isClosed ? "closed" : lead.stage;

  return (
    <SurfaceCard label={t("outcome")} fact={t("currentStage", { stage: stageLabel(lead.stage, tc) })}>
      <div className={STACK}>
        <Stepper label={t("stageStepperLabel")} steps={steps} currentStepId={currentStepId} />
        <div className={EVIDENCE_STACK}>
          <Meter
            label={t("evidenceState")}
            value={evidenceStep - 1}
            maxValue={ladder.length}
            valueLabel={ladder[evidenceStep - 1]}
          />
          <Text as="p" size="xs" tone="muted">
            {t("evidenceNote", { ladder: ladder.join(" → ") })}
          </Text>
        </div>
        <OutcomeForm leadId={lead.id} currentStage={lead.stage} />
        {evidence.length === 0 ? (
          <EmptyNotice message={t("noEvidence")} description={t("noEvidenceHint")} />
        ) : (
          <div className={EVIDENCE_STACK}>
            <Text as="p" size="sm" weight="semibold">{t("evidenceRecorded", { count: evidence.length })}</Text>
            {evidence.map((event) => (
              <SurfaceCard key={event.id} depth="nested" ariaLabel={t("evidenceAria", { label: event.label })}>
                <div className={EVIDENCE_ITEM}>
                  <div className={EVIDENCE_HEAD}>
                    <Icon source={nivoIconSource("blog", "chip")} usage="chip" />
                    <Text as="span" size="xs" tone="muted" weight="semibold">{t("evidence")}</Text>
                    <Text as="span" size="xs" tone="muted">{`· ${event.label} · ${event.actor} · ${event.timeLabel}`}</Text>
                  </div>
                  <Text as="p" size="sm">{event.evidence}</Text>
                </div>
              </SurfaceCard>
            ))}
          </div>
        )}
      </div>
    </SurfaceCard>
  );
};

/** Rail card: append-only audit trail of every event on the lead. */
export const HistoryPanel = (props: PanelProps) => {
  const t = useT(leadDict);
  const locale = useLocale();
  const events = toEventViews(props.detail.events, Date.now(), t, locale);

  return (
    <div id="history" className={HISTORY_ANCHOR}>
    <SurfaceCard label={t("history")} fact={t("eventsCount", { count: events.length })}>
      <div className={STACK}>
        {events.length === 0 ? (
          <EmptyNotice message={t("noHistory")} description={t("noHistoryHint")} />
        ) : (
          <HistoryList events={events} />
        )}
        <Text as="p" size="xs" tone="muted">{t("auditFooter")}</Text>
      </div>
    </SurfaceCard>
    </div>
  );
};
