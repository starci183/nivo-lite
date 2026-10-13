import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { InventoryWorkbenchPageBase } from "./component"

/** What the agent workbench route hands the slot. */
interface InventoryWorkbenchPageProps {
    /** `?tab=` from the route (stock, orders, suppliers, history, recipes, count, import); anything else opens the first tab. */
    readonly tab?: string | null
    /** The id of the installation the workbench is opened for, from the route. */
    readonly installationId?: string
}

/** The Inventory workbench slot: a thin server shell that hands the words and ids to the frame; every surface reads its own data. */
export const InventoryWorkbenchPage = async (props: InventoryWorkbenchPageProps) => {
    if (props.installationId === undefined) notFound()
    const t = await getTranslations("workbenchInventory")
    return (
        <InventoryWorkbenchPageBase
            props={{
                installationId: props.installationId,
                initialTab: props.tab ?? null,
                tabs: {
                    stock: t("tab_stock"),
                    orders: t("tab_orders"),
                    suppliers: t("tab_suppliers"),
                    history: t("tab_history"),
                    recipes: t("tab_recipes"),
                    count: t("tab_count"),
                    import: t("tab_import"),
                },
                terms: [t("metricReorder"), t("metricAwaiting"), t("metricValue"), t("metricStockOuts")],
            }}
        />
    )
}
