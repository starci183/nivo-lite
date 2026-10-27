import { LeadContext } from "@/components/blocks/LeadContext"
import { LeadExecution } from "@/components/blocks/LeadExecution"
import { LeadHeader } from "@/components/blocks/LeadHeader"
import { LeadHistory } from "@/components/blocks/LeadHistory"
import { LeadOutcome } from "@/components/blocks/LeadOutcome"
import { LeadPreviousSteps } from "@/components/blocks/LeadPreviousSteps"
import { LeadResponsibility } from "@/components/blocks/LeadResponsibility"
import { LeadWorkFlow } from "@/components/blocks/LeadWorkFlow"
import { PromoLeadWait } from "@/components/blocks/PromoLeadWait"
import { LeadPageLayout } from "@/components/composites/LeadPageLayout"

/** The lead the page draws. */
export interface LeadPageBaseProps {
    readonly props: { readonly leadId: string }
}

/** Draws the lead page: the header, the work panels and the rail, all connected to the lead's SWR query. */
export const LeadPageBase = (props: LeadPageBaseProps) => {
    const leadId = props.props.leadId
    return (
        <LeadPageLayout
            header={<LeadHeader leadId={leadId} />}
            primary={
                <>
                    <LeadExecution leadId={leadId} />
                    <LeadWorkFlow leadId={leadId} />
                    <LeadHistory leadId={leadId} />
                    <PromoLeadWait leadId={leadId} />
                </>
            }
            rail={
                <>
                    <LeadResponsibility leadId={leadId} />
                    <LeadPreviousSteps leadId={leadId} />
                    <LeadContext leadId={leadId} />
                    <LeadOutcome leadId={leadId} />
                </>
            }
        />
    )
}
