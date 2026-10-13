import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
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

interface LeadPageProps {
    readonly leadId: string
}

/** The lead page's localized document title. */
export const leadPageMetadata = async (): Promise<Metadata> => ({
    title: (await getTranslations("leads"))("detailEyebrow"),
})

/** A server shell: connected browser panels share the lead's SWR query. */
export const LeadPage = (props: LeadPageProps) => (
    <LeadPageLayout
        header={<LeadHeader leadId={props.leadId} />}
        primary={
            <>
                <LeadExecution leadId={props.leadId} />
                <LeadWorkFlow leadId={props.leadId} />
                <LeadHistory leadId={props.leadId} />
                <PromoLeadWait leadId={props.leadId} />
            </>
        }
        rail={
            <>
                <LeadResponsibility leadId={props.leadId} />
                <LeadPreviousSteps leadId={props.leadId} />
                <LeadContext leadId={props.leadId} />
                <LeadOutcome leadId={props.leadId} />
            </>
        }
    />
)
