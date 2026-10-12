import { notFound } from "next/navigation";
import { getLeadDetail } from "@/lib/queries";
import { LeadWaitNudge } from "@/features/promo-ads/LeadWaitNudge";
import { FlowPanel } from "@/features/lead-detail/flow";
import { ResponsibilityPanel } from "@/features/lead-detail/responsibility";
import { LeadPageView } from "@/features/lead-detail/page/view";

type LeadPageProps = { readonly params: Promise<{ id: string }> };

/** Lead journey page: context, responsibility, execution, outcome and history. A failed load reaches error.tsx (STATE-8 case-4). */
const LeadPage = async ({ params }: LeadPageProps) => {
  const { id } = await params;
  const detail = await getLeadDetail(id);
  if (detail === null) notFound();

  return (
    <LeadPageView
      detail={detail}
      flow={<FlowPanel leadId={detail.lead.id} />}
      responsibility={<ResponsibilityPanel detail={detail} />}
      nudge={<LeadWaitNudge leadId={detail.lead.id} />}
    />
  );
};

export default LeadPage;

/** OpenClaw writes the text (setup chat, Office replies, classification), so these screens may wait longer than the platform default. */
export const maxDuration = 60;
