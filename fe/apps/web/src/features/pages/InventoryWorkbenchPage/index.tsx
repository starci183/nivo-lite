import { getFormatter, getTranslations } from "next-intl/server"
import { loadAgentDashboard } from "@/lib/agent-dashboard"
import { workbenchHref } from "@/lib/agent-dashboard-shared"
import { getCurrentMember, isManagerRole } from "@/lib/members"
import { readInventoryWorkbench } from "@/modules/db"
import type { InventoryWorkbenchData } from "@/modules/types"
import { InventoryWorkbenchBase } from "./component"

/** What the route passes. */
interface InventoryWorkbenchPageProps {
    /** `?tab=` from the route (stock, orders, suppliers, history, recipes, count, import); anything else opens the first tab. */
    readonly tab?: string | null
}

const TAB_IDS: ReadonlyArray<string> = ["stock", "orders", "suppliers", "history", "recipes", "count", "import"]

type Format = Awaited<ReturnType<typeof getFormatter>>
type Translate = Awaited<ReturnType<typeof getTranslations>>

/** The ribbon: items under their reorder level, orders waiting, stock value and the stock-outs of the week. */
const figuresOf = (data: InventoryWorkbenchData, format: Format, t: Translate) => {
    const active = data.items.filter((item) => item.active)
    const below = active.filter((item) => item.reorderPoint > 0 && item.total <= item.reorderPoint).length
    const awaiting = data.pos.filter((po) => po.status === "waiting_approval").length
    return [
        {
            id: "reorder",
            term: t("metricReorder"),
            description: String(below),
            meta: t("metricReorderBasis", { n: active.length }),
        },
        { id: "awaiting", term: t("metricAwaiting"), description: String(awaiting), meta: t("metricAwaitingBasis") },
        {
            id: "value",
            term: t("metricValue"),
            description: format.number(data.metrics.valueVnd, {
                style: "currency",
                currency: "VND",
                maximumFractionDigits: 0,
            }),
            meta: t("metricValueBasis"),
        },
        {
            id: "stockouts",
            term: t("metricStockOuts"),
            description: data.stockOuts7d === null ? "-" : String(data.stockOuts7d),
            meta: t(data.stockOuts7d === null ? "metricStockOutsUnknown" : "metricStockOutsBasis"),
        },
    ]
}

/** The Inventory workbench slot: reads the inventory under the member's own session and still renders the frame when the tables are not ready. */
export const InventoryWorkbenchPage = async (props: InventoryWorkbenchPageProps) => {
    const t = await getTranslations("workbenchInventory")
    const format = await getFormatter()
    const me = await getCurrentMember()
    const [dashboard, workbench] = await Promise.all([
        // Every waiting inventory item (send a purchase order, adjust stock) is decided from the top of the Purchase orders tab.
        loadAgentDashboard("inventory", {
            decisionHref: (item) => workbenchHref("inventory", { tab: "orders", focus: item.id }),
        }),
        readInventoryWorkbench(me.workspaceId, isManagerRole(me.role)),
    ])
    const data = workbench.kind === "ok" ? workbench.value : null
    const openOrders = data === null || data.metrics.openPos === 0 ? "" : ` (${data.metrics.openPos})`
    return (
        <InventoryWorkbenchBase
            props={{
                dashboard,
                data,
                workspaceId: me.workspaceId,
                figures: data === null ? [] : figuresOf(data, format, t),
                tabs: TAB_IDS.map((id) => ({
                    id,
                    label: id === "orders" ? `${t("tab_orders")}${openOrders}` : t(`tab_${id}`),
                })),
                initialTab: props.tab ?? null,
                failedTab: t("tab_stock"),
                failedTitle: t("loadFailedTitle"),
                failedBody: t("loadFailedBody"),
            }}
        />
    )
}
