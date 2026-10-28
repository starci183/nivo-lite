import { Page } from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"
import { LeadContext } from "@/components/blocks/LeadContext"
import { LeadExecution } from "@/components/blocks/LeadExecution"
import { LeadHeader } from "@/components/blocks/LeadHeader"
import { LeadHeaderActions } from "@/components/blocks/LeadHeaderActions"
import { LeadHistory } from "@/components/blocks/LeadHistory"
import { LeadOutcome } from "@/components/blocks/LeadOutcome"
import { LeadPreviousSteps } from "@/components/blocks/LeadPreviousSteps"
import { LeadResponsibility } from "@/components/blocks/LeadResponsibility"
import { LeadWorkFlow } from "@/components/blocks/LeadWorkFlow"
import { PromoLeadWait } from "@/components/blocks/PromoLeadWait"
import { LeadPageLayout } from "@/components/composites/LeadPageLayout"

/** The lead the page draws and the words of its trail. */
export interface LeadPageBaseProps {
    readonly props: {
        readonly leadId: string
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
    }
}

/** Draws the lead page: the head (the trail, the lead's mark, name, stage and actions), the work panels and the rail, all connected to the lead's SWR query. */
export const LeadPageBase = (props: LeadPageBaseProps) => {
    const leadId = props.props.leadId
    return (
        <Page
            measure="product"
            header={{
                breadcrumbs: { label: props.props.crumbLabel, items: props.props.crumbs },
                mark: <LeadHeader leadId={leadId} part="mark" />,
                title: <LeadHeader leadId={leadId} part="title" />,
                status: <LeadHeader leadId={leadId} part="status" />,
                description: <LeadHeader leadId={leadId} part="description" />,
                actions: <LeadHeaderActions leadId={leadId} />,
            }}
        >
            <LeadPageLayout
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
        </Page>
    )
}
