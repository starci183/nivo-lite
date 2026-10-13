import { Alert } from "@starci/grammar/common"
import type { DescriptionListStatItem } from "@starci/grammar/common"
import { AgentDashboardFrame } from "@/features/agent-dashboard"
import type { AgentDashboardData } from "@/lib/agent-dashboard-shared"

/** The tab labels, with their counts. */
interface LeadGenWorkbenchLabels {
    readonly leads: string
    readonly sources: string
    readonly comments: string
    readonly handoffs: string
}

/** What the Lead Gen workbench draws: the frame regions, the figures, whether the workbench was read, the areas and the words. */
interface LeadGenWorkbenchBaseProps {
    readonly props: {
        readonly dashboard?: AgentDashboardData
        readonly figures: ReadonlyArray<DescriptionListStatItem>
        /** The selected tab: the page draws its area under the frame. */
        readonly tab: string
        readonly isLoading: boolean
        readonly error: string | null
        readonly errorTitle: string
        readonly retryLabel: string
        readonly labels: LeadGenWorkbenchLabels
    }
    readonly on: { readonly tab: (id: string) => void; readonly retry: () => void }
}

/** The shared dashboard frame around the four Lead Gen collections. */
export const LeadGenWorkbenchBase = (props: LeadGenWorkbenchBaseProps) => {
    const { props: p, on } = props
    return (
        <>
            {p.error ? (
                <Alert
                    tone="negative"
                    title={p.errorTitle}
                    description={p.error}
                    action={{ label: p.retryLabel, onAction: on.retry }}
                />
            ) : null}
            <AgentDashboardFrame
                module="lead_gen"
                data={p.dashboard}
                isLoading={p.isLoading}
                tab={p.tab}
                onTabChange={on.tab}
                figures={p.figures}
                tabs={[
                    { id: "leads", label: p.labels.leads },
                    { id: "sources", label: p.labels.sources },
                    { id: "comments", label: p.labels.comments },
                    { id: "handoffs", label: p.labels.handoffs },
                ]}
            />
        </>
    )
}
