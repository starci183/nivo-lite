import type { DescriptionListStatItem } from "@starci/grammar/common"
import { SalesActivity } from "@/components/blocks/SalesActivity"
import { SalesAttention } from "@/components/blocks/SalesAttention"
import { SalesContracts } from "@/components/blocks/SalesContracts"
import { SalesDecisions } from "@/components/blocks/SalesDecisions"
import { SalesHandoffs } from "@/components/blocks/SalesHandoffs"
import { SalesPipeline } from "@/components/blocks/SalesPipeline"
import { LoadFailedNotice } from "@/components/composites/LoadFailedNotice"
import { AgentDashboardFrame } from "@/features/agent-dashboard"
import type { AgentDashboardData } from "@/lib/agent-dashboard-shared"
import type { SalesWorkbenchData } from "@/modules/types"

/** The words of the workbench: the tab labels (with their counts) and what a failed read says. */
interface SalesWorkbenchLabels {
    readonly attention: string
    readonly pipeline: string
    readonly decisions: string
    readonly handoff: string
    readonly contracts: string
    readonly activity: string
    readonly loadFailedTitle: string
    readonly loadFailedBody: string
}

/** What the Sales workbench draws: the frame regions, the figures, the data (null when the read failed) and the words. */
interface SalesWorkbenchPageBaseProps {
    readonly props: {
        readonly dashboard: AgentDashboardData
        readonly figures: ReadonlyArray<DescriptionListStatItem>
        readonly data: SalesWorkbenchData | null
        readonly initialTab: string
        readonly focus: string | null
        readonly workspaceId: string
        readonly labels: SalesWorkbenchLabels
    }
}

/** The Sales workbench: the agent dashboard frame around the six Sales areas, or around a notice when the tables could not be read. */
export const SalesWorkbenchPageBase = (props: SalesWorkbenchPageBaseProps) => {
    const { dashboard, figures, data, initialTab, focus, workspaceId, labels } = props.props
    if (data === null) {
        return (
            <AgentDashboardFrame
                module="sales"
                data={dashboard}
                figures={[]}
                figuresFailed
                tabs={[
                    {
                        id: "attention",
                        label: labels.attention,
                        content: <LoadFailedNotice title={labels.loadFailedTitle} body={labels.loadFailedBody} />,
                    },
                ]}
            />
        )
    }
    return (
        <AgentDashboardFrame
            key={`${initialTab}:${focus ?? ""}`}
            module="sales"
            data={dashboard}
            figures={figures}
            initialTab={initialTab}
            tabs={[
                {
                    id: "attention",
                    label: labels.attention,
                    content: <SalesAttention rows={data.attention} nowIso={data.nowIso} />,
                },
                {
                    id: "pipeline",
                    label: labels.pipeline,
                    content: (
                        <SalesPipeline deals={data.deals} closedHidden={data.closedHidden} workspaceId={workspaceId} />
                    ),
                },
                {
                    id: "decisions",
                    label: labels.decisions,
                    content: (
                        <SalesDecisions
                            pending={data.decisions}
                            decided={data.decided}
                            nowIso={data.nowIso}
                            focusId={focus}
                        />
                    ),
                },
                { id: "handoff", label: labels.handoff, content: <SalesHandoffs rows={data.handoffs} /> },
                {
                    id: "contracts",
                    label: labels.contracts,
                    content: (
                        <SalesContracts
                            contracts={data.contracts}
                            leads={data.leadOptions}
                            nowIso={data.nowIso}
                            workspaceId={workspaceId}
                        />
                    ),
                },
                { id: "activity", label: labels.activity, content: <SalesActivity rows={data.activity} /> },
            ]}
        />
    )
}
