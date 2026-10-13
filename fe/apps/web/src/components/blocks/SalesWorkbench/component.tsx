import type { DescriptionListStatItem } from "@starci/grammar/common"
import { SurfaceListCard } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import { AgentDashboardFrame } from "@/features/agent-dashboard"
import type { AgentDashboardData } from "@/lib/agent-dashboard-shared"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** The words of the workbench: the tab labels (with their counts) and what a failed read says. */
interface SalesWorkbenchLabels {
    readonly attention: string
    readonly pipeline: string
    readonly decisions: string
    readonly handoff: string
    readonly contracts: string
    readonly activity: string
    readonly slot: SlotLabels
}

/** What the Sales workbench draws: the frame regions, the figures, whether the tables were read, the areas and the words. */
interface SalesWorkbenchBaseProps {
    readonly props: {
        readonly dashboard: AgentDashboardData
        readonly figures: ReadonlyArray<DescriptionListStatItem>
        /** Loading, failed, or ready (an item of true). */
        readonly slot: DataSlot<true>
        /** The selected tab: the page draws its area under the frame. */
        readonly tab: string
        readonly labels: SalesWorkbenchLabels
    }
    readonly on: {
        readonly tab: (id: string) => void
        readonly retry: () => void
    }
}

/** The Sales workbench: the agent dashboard frame around the six Sales areas, or around a notice when the tables could not be read. */
export const SalesWorkbenchBase = (props: SalesWorkbenchBaseProps) => {
    const { props: p, on } = props
    const l = p.labels
    const isReady = p.slot.items === true
    if (!isReady) {
        return (
            <AgentDashboardFrame
                module="sales"
                data={p.dashboard}
                figures={[]}
                isLoading={p.slot.isLoading}
                tabs={[
                    {
                        id: "attention",
                        label: l.attention,
                        content: (
                            <SlotView slot={p.slot} placeholder labels={l.slot} onRetry={on.retry}>
                                {() => <SurfaceListCard ariaLabel={l.attention} isLoading />}
                            </SlotView>
                        ),
                    },
                ]}
            />
        )
    }
    return (
        <AgentDashboardFrame
            module="sales"
            data={p.dashboard}
            figures={p.figures}
            tab={p.tab}
            onTabChange={on.tab}
            tabs={[
                { id: "attention", label: l.attention },
                { id: "pipeline", label: l.pipeline },
                { id: "decisions", label: l.decisions },
                { id: "handoff", label: l.handoff },
                { id: "contracts", label: l.contracts },
                { id: "activity", label: l.activity },
            ]}
        />
    )
}
