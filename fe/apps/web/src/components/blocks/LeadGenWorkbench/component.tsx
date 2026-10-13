import { Alert } from "@starci/grammar/common"
import type { DescriptionListStatItem } from "@starci/grammar/common"
import { LeadGenCommentList } from "@/components/composites/LeadGenCommentList"
import type { LeadGenCommentListData } from "@/components/composites/LeadGenCommentList"
import { LeadGenRowList } from "@/components/composites/LeadGenRowList"
import type { LeadGenRowListProps } from "@/components/composites/LeadGenRowList"
import { AgentDashboardFrame } from "@/features/agent-dashboard"
import type { AgentDashboardData } from "@/lib/agent-dashboard-shared"

/** Data and resolved labels of the connected Lead Gen workbench. */
interface LeadGenWorkbenchBaseProps {
    readonly props: {
        readonly dashboard?: AgentDashboardData
        readonly figures: ReadonlyArray<DescriptionListStatItem>
        readonly leads: LeadGenRowListProps | null
        readonly sources: LeadGenRowListProps | null
        readonly comments: LeadGenCommentListData | null
        readonly handoffs: LeadGenRowListProps | null
        readonly initialTab: string | null
        readonly isLoading: boolean
        readonly failed: boolean
        readonly figuresFailed: boolean
        readonly labels: {
            readonly leads: string
            readonly sources: string
            readonly comments: string
            readonly handoffs: string
            readonly failedTitle: string
            readonly failedBody: string
            readonly retry: string
        }
    }
    readonly on: {
        readonly retry: () => void
        readonly commentEdit: (id: string) => void
        readonly commentCancel: (id: string) => void
        readonly commentDraft: (id: string, value: string) => void
        readonly commentApprove: (id: string, edited: boolean) => void
        readonly commentRetry: () => void
    }
}

/** Draws the four Lead Gen areas inside the shared dashboard frame. */
export const LeadGenWorkbenchBase = (props: LeadGenWorkbenchBaseProps) => {
    const { props: p, on } = props
    return (
        <>
            {p.failed ? (
                <Alert
                    tone="negative"
                    title={p.labels.failedTitle}
                    description={p.labels.failedBody}
                    action={{ label: p.labels.retry, onAction: on.retry }}
                />
            ) : null}
            <AgentDashboardFrame
                module="lead_gen"
                data={p.dashboard}
                initialTab={p.initialTab}
                figures={p.figures}
                isLoading={p.isLoading}
                figuresFailed={p.figuresFailed}
                tabs={[
                    {
                        id: "leads",
                        label: p.labels.leads,
                        content: p.leads ? <LeadGenRowList {...p.leads} /> : undefined,
                    },
                    {
                        id: "sources",
                        label: p.labels.sources,
                        content: p.sources ? <LeadGenRowList {...p.sources} /> : undefined,
                    },
                    {
                        id: "comments",
                        label: p.labels.comments,
                        content: p.comments ? (
                            <LeadGenCommentList
                                {...p.comments}
                                onEdit={on.commentEdit}
                                onCancel={on.commentCancel}
                                onDraft={on.commentDraft}
                                onApprove={on.commentApprove}
                                onRetry={on.commentRetry}
                            />
                        ) : undefined,
                    },
                    {
                        id: "handoffs",
                        label: p.labels.handoffs,
                        content: p.handoffs ? <LeadGenRowList {...p.handoffs} /> : undefined,
                    },
                ]}
            />
        </>
    )
}
