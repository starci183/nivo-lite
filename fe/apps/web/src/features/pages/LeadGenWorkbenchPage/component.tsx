import type { DescriptionListStatItem } from "@starci/grammar/common"
import { LeadGenComments } from "@/components/blocks/LeadGenComments"
import { LeadGenHandoffs } from "@/components/blocks/LeadGenHandoffs"
import { LeadGenLeads } from "@/components/blocks/LeadGenLeads"
import { LeadGenSources } from "@/components/blocks/LeadGenSources"
import { AgentDashboardFrame } from "@/features/agent-dashboard"
import type { AgentDashboardData } from "@/lib/agent-dashboard-shared"
import type { LeadGenWorkbenchData } from "@/modules/types"

/** What the Lead Gen workbench draws: the frame regions, the figures, the data, the tab to open and the tab labels. */
interface LeadGenWorkbenchPageBaseProps {
    readonly props: {
        readonly dashboard: AgentDashboardData
        readonly figures: ReadonlyArray<DescriptionListStatItem>
        readonly data: LeadGenWorkbenchData
        readonly initialTab: string | null
        readonly labels: {
            readonly leads: string
            readonly sources: string
            readonly comments: string
            readonly handoffs: string
        }
    }
}

/** The Lead Gen workbench: the agent dashboard frame around the four Lead Gen areas. */
export const LeadGenWorkbenchPageBase = (props: LeadGenWorkbenchPageBaseProps) => {
    const { dashboard, figures, data, initialTab, labels } = props.props
    return (
        <AgentDashboardFrame
            module="lead_gen"
            data={dashboard}
            initialTab={initialTab}
            figures={figures}
            tabs={[
                {
                    id: "leads",
                    label: labels.leads,
                    content: <LeadGenLeads rows={data.leads} hidden={data.leadsHidden} />,
                },
                { id: "sources", label: labels.sources, content: <LeadGenSources rows={data.sources} /> },
                { id: "comments", label: labels.comments, content: <LeadGenComments rows={data.comments} /> },
                { id: "handoffs", label: labels.handoffs, content: <LeadGenHandoffs rows={data.handoffs} /> },
            ]}
        />
    )
}
