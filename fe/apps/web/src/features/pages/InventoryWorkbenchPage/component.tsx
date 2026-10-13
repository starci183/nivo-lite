import { AgentDashboardFrame } from "@/components/blocks/AgentDashboardFrame"
import { InventoryCount } from "@/components/blocks/InventoryCount"
import { InventoryFigures } from "@/components/blocks/InventoryFigures"
import { InventoryHistory } from "@/components/blocks/InventoryHistory"
import { InventoryImport } from "@/components/blocks/InventoryImport"
import { InventoryOrders } from "@/components/blocks/InventoryOrders"
import { InventoryPending } from "@/components/blocks/InventoryPending"
import { InventoryRecipes } from "@/components/blocks/InventoryRecipes"
import { InventoryStock } from "@/components/blocks/InventoryStock"
import { InventorySuppliers } from "@/components/blocks/InventorySuppliers"
import { PANEL_CLASS_NAME } from "./classNames"

/** What the server shell settled: the deep link, the installation and the words. */
export interface InventoryWorkbenchPageBaseProps {
    readonly props: {
        readonly installationId: string
        readonly initialTab: string | null
        readonly tabs: {
            readonly stock: string
            readonly orders: string
            readonly suppliers: string
            readonly history: string
            readonly recipes: string
            readonly count: string
            readonly import: string
        }
    }
}

/** Draws the Inventory workbench: the agent dashboard frame around the seven inventory surfaces, each reading its own data. */
export const InventoryWorkbenchPageBase = (props: InventoryWorkbenchPageBaseProps) => {
    const p = props.props
    return (
        <AgentDashboardFrame
            module="inventory"
            installationId={p.installationId}
            initialTab={p.initialTab}
            ribbon={<InventoryFigures />}
            tabs={[
                {
                    id: "stock",
                    label: p.tabs.stock,
                    content: <InventoryStock />,
                },
                {
                    id: "orders",
                    label: p.tabs.orders,
                    content: (
                        <div className={PANEL_CLASS_NAME}>
                            <InventoryPending />
                            <InventoryOrders />
                        </div>
                    ),
                },
                { id: "suppliers", label: p.tabs.suppliers, content: <InventorySuppliers /> },
                { id: "history", label: p.tabs.history, content: <InventoryHistory /> },
                { id: "recipes", label: p.tabs.recipes, content: <InventoryRecipes /> },
                { id: "count", label: p.tabs.count, content: <InventoryCount /> },
                { id: "import", label: p.tabs.import, content: <InventoryImport /> },
            ]}
        />
    )
}
