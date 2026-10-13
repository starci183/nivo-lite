import { AgentDashboardFrame } from "@/components/blocks/AgentDashboardFrame"
import { LeadGenComments } from "@/components/blocks/LeadGenComments"
import { LeadGenFigures } from "@/components/blocks/LeadGenFigures"
import { LeadGenList } from "@/components/blocks/LeadGenList"

/** Route identity and tab names of the Lead Gen workbench. */
interface LeadGenWorkbenchPageBaseProps {
    readonly props: {
        readonly installationId: string | null
        readonly initialTab: string | null
        readonly tabs: {
            readonly leads: string
            readonly sources: string
            readonly comments: string
            readonly handoffs: string
        }
    }
}

/** Draws the Lead Gen workbench: the agent dashboard frame around the prospects, sources, comments and Sales handoffs. */
export const LeadGenWorkbenchPageBase = (props: LeadGenWorkbenchPageBaseProps) => {
    const p = props.props
    return (
        <AgentDashboardFrame
            module="lead_gen"
            installationId={p.installationId}
            initialTab={p.initialTab}
            ribbon={<LeadGenFigures installationId={p.installationId} />}
            waitingTab="comments"
            tabs={[
                {
                    id: "leads",
                    label: p.tabs.leads,
                    content: <LeadGenList installationId={p.installationId} kind="leads" />,
                },
                {
                    id: "sources",
                    label: p.tabs.sources,
                    content: <LeadGenList installationId={p.installationId} kind="sources" />,
                },
                {
                    id: "comments",
                    label: p.tabs.comments,
                    content: <LeadGenComments installationId={p.installationId} />,
                },
                {
                    id: "handoffs",
                    label: p.tabs.handoffs,
                    content: <LeadGenList installationId={p.installationId} kind="handoffs" />,
                },
            ]}
        />
    )
}
