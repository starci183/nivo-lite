import { notFound } from "next/navigation";
import { PageContainer, PrimaryRailLayout } from "@starci/grammar/common";
import { getLeadDetail } from "@/lib/queries";
import { channelKeyOf } from "@/features/leads-list/stage";
import { getLocale, getT } from "@/i18n/server";
import { leads } from "@/i18n/dict/leads";
import { ContextPanel } from "@/features/lead-detail/context";
import { LeadWaitNudge } from "@/features/promo-ads/LeadWaitNudge";
import { ExecutionPanel } from "@/features/lead-detail/execution";
import { HistoryPanel, OutcomePanel } from "@/features/lead-detail/outcome";
import { ResponsibilityPanel } from "@/features/lead-detail/responsibility";
import { FlowPanel } from "@/features/lead-detail/flow";
import { LeadHeader } from "@/features/lead-detail/page/header";
import { ANCHOR_CLASS_NAME, PAGE_CLASS_NAME, PRIMARY_CLASS_NAME, RAIL_CLASS_NAME } from "@/features/lead-detail/page/classNames";
import { formatCaptured, STAGE_KEY, STAGE_TONE } from "@/features/lead-detail/page/format";
import { primaryActionOf } from "@/features/lead-detail/page/journey";

type LeadPageProps = { readonly params: Promise<{ id: string }> };

/** Lead journey page: context, responsibility, execution, outcome and history. */
const LeadPage = async ({ params }: LeadPageProps) => {
  const { id } = await params;
  const detail = await getLeadDetail(id);
  if (detail === null) notFound();
  const { lead } = detail;
  const [t, locale] = await Promise.all([getT(leads), getLocale()]);
  const channelKey = channelKeyOf(lead.channel);

  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS_NAME}>
        <LeadHeader
          leadId={lead.id}
          name={lead.contact_name}
          meta={t("metaLine", { company: lead.company, channel: channelKey ? t(channelKey) : lead.channel, time: formatCaptured(lead.created_at, locale) })}
          stageLabel={t(STAGE_KEY[lead.stage])}
          stageTone={STAGE_TONE[lead.stage]}
          primary={primaryActionOf(detail)}
        />
        <PrimaryRailLayout
          railWidth="standard"
          align="start"
          primary={
            <div className={PRIMARY_CLASS_NAME}>
              <div id="execution" className={ANCHOR_CLASS_NAME}><ExecutionPanel detail={detail} /></div>
              <div id="flow" className={ANCHOR_CLASS_NAME}><FlowPanel leadId={lead.id} /></div>
              <HistoryPanel detail={detail} />
              <LeadWaitNudge leadId={lead.id} />
            </div>
          }
          rail={
            <div className={RAIL_CLASS_NAME}>
              <div id="responsibility" className={ANCHOR_CLASS_NAME}><ResponsibilityPanel detail={detail} /></div>
              <div id="context" className={ANCHOR_CLASS_NAME}><ContextPanel detail={detail} /></div>
              <div id="outcome" className={ANCHOR_CLASS_NAME}><OutcomePanel detail={detail} /></div>
            </div>
          }
        />
      </div>
    </PageContainer>
  );
};

export default LeadPage;
