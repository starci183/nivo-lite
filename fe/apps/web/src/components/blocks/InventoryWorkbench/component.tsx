import { EmptyNotice, SurfaceCard } from "@starci/grammar/common"
import type { DescriptionListStatItem } from "@starci/grammar/common"
import { AgentDashboardFrame } from "@/components/blocks/AgentDashboardFrame"
import { InventoryCount } from "@/components/blocks/InventoryCount"
import { InventoryHistory } from "@/components/blocks/InventoryHistory"
import { InventoryImport } from "@/components/blocks/InventoryImport"
import { InventoryOrders } from "@/components/blocks/InventoryOrders"
import { InventoryPending } from "@/components/blocks/InventoryPending"
import { InventoryRecipes } from "@/components/blocks/InventoryRecipes"
import { InventoryStock } from "@/components/blocks/InventoryStock"
import { InventorySuppliers } from "@/components/blocks/InventorySuppliers"
import type { InventoryWorkbenchData } from "@/modules/types"

/** One tab of the workbench: its id and its label. */
interface InventoryTabView {
    readonly id: string
    readonly label: string
}

/** What the connected block settled: the frame state, the ribbon, the tab labels and the board when it was read. */
export interface InventoryWorkbenchBaseProps {
    readonly props: {
        readonly installationId: string | null
        readonly initialTab: string | null
        /** The board is not read yet. */
        readonly isLoading: boolean
        /** The board could not be read. */
        readonly isFailed: boolean
        readonly data: InventoryWorkbenchData | undefined
        readonly figures: ReadonlyArray<DescriptionListStatItem>
        readonly tabs: ReadonlyArray<InventoryTabView>
        readonly failedTitle: string
        readonly failedBody: string
    }
}

const contentOf = (id: string, data: InventoryWorkbenchData) => {
    if (id === "orders") {
        return (
            <>
                <InventoryPending rows={data.pending} />
                <InventoryOrders data={data} />
            </>
        )
    }
    if (id === "suppliers") return <InventorySuppliers data={data} />
    if (id === "history") return <InventoryHistory movements={data.movements} />
    if (id === "recipes") return <InventoryRecipes data={data} />
    if (id === "count") return <InventoryCount data={data} />
    if (id === "import") return <InventoryImport canManage={data.canManage} />
    return <InventoryStock data={data} />
}

/** Draws the Inventory workbench: the agent dashboard frame around the seven inventory surfaces, or one notice when the board could not be read. */
export const InventoryWorkbenchBase = (props: InventoryWorkbenchBaseProps) => {
    const p = props.props
    if (p.isFailed) {
        return (
            <AgentDashboardFrame
                module="inventory"
                installationId={p.installationId}
                figures={[]}
                figuresFailed
                tabs={[
                    {
                        id: "stock",
                        label: p.tabs[0]?.label ?? "",
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
            installationId={p.installationId}
            isLoading={p.isLoading}
            figures={p.figures}
            initialTab={p.initialTab}
            tabs={p.tabs.map((tab) => ({
                id: tab.id,
                label: tab.label,
                content: p.data === undefined ? undefined : contentOf(tab.id, p.data),
            }))}
        />
    )
}
