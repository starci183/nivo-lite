import { EmptyNotice, SurfaceCard } from "@starci/grammar/common"
import type { DescriptionListStatItem } from "@starci/grammar/common"
import { InventoryCount } from "@/components/blocks/InventoryCount"
import { InventoryHistory } from "@/components/blocks/InventoryHistory"
import { InventoryImport } from "@/components/blocks/InventoryImport"
import { InventoryOrders } from "@/components/blocks/InventoryOrders"
import { InventoryPending } from "@/components/blocks/InventoryPending"
import { InventoryRecipes } from "@/components/blocks/InventoryRecipes"
import { InventoryStock } from "@/components/blocks/InventoryStock"
import { InventorySuppliers } from "@/components/blocks/InventorySuppliers"
import { AgentDashboardFrame } from "@/features/agent-dashboard"
import type { AgentDashboardData } from "@/lib/agent-dashboard-shared"
import type { InventoryWorkbenchData } from "@/modules/types"

/** One tab of the workbench: its id and its label. */
export interface InventoryTabView {
    readonly id: string
    readonly label: string
}

/** The words and data of the inventory workbench. */
export interface InventoryWorkbenchBaseProps {
    readonly props: {
        /** The frame regions (waiting, done, connections, knowledge), loaded on the server. */
        readonly dashboard: AgentDashboardData
        /** Null when the inventory tables could not be read: the frame then shows one failure notice. */
        readonly data: InventoryWorkbenchData | null
        readonly workspaceId: string
        readonly figures: ReadonlyArray<DescriptionListStatItem>
        readonly tabs: ReadonlyArray<InventoryTabView>
        readonly initialTab: string | null
        readonly failedTab: string
        readonly failedTitle: string
        readonly failedBody: string
    }
}

const contentOf = (id: string, data: InventoryWorkbenchData, workspaceId: string) => {
    if (id === "orders") {
        return (
            <>
                <InventoryPending rows={data.pending} />
                <InventoryOrders data={data} workspaceId={workspaceId} />
            </>
        )
    }
    if (id === "suppliers") return <InventorySuppliers data={data} workspaceId={workspaceId} />
    if (id === "history") return <InventoryHistory movements={data.movements} />
    if (id === "recipes") return <InventoryRecipes data={data} workspaceId={workspaceId} />
    if (id === "count") return <InventoryCount data={data} workspaceId={workspaceId} />
    if (id === "import") return <InventoryImport canManage={data.canManage} workspaceId={workspaceId} />
    return <InventoryStock data={data} workspaceId={workspaceId} />
}

/** The Inventory workbench: the agent dashboard frame around the seven inventory surfaces as tabs. */
export const InventoryWorkbenchBase = (props: InventoryWorkbenchBaseProps) => {
    const p = props.props
    const data = p.data
    if (data === null) {
        return (
            <AgentDashboardFrame
                module="inventory"
                data={p.dashboard}
                figures={[]}
                figuresFailed
                tabs={[
                    {
                        id: "stock",
                        label: p.failedTab,
                        content: (
                            <SurfaceCard ariaLabel={p.failedTitle}>
                                <EmptyNotice message={p.failedTitle} description={p.failedBody} />
                            </SurfaceCard>
                        ),
                    },
                ]}
            />
        )
    }
    return (
        <AgentDashboardFrame
            module="inventory"
            data={p.dashboard}
            figures={p.figures}
            initialTab={p.initialTab}
            tabs={p.tabs.map((tab) => ({
                id: tab.id,
                label: tab.label,
                content: contentOf(tab.id, data, p.workspaceId),
            }))}
        />
    )
}
