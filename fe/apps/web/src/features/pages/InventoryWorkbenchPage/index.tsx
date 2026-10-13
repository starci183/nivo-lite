import { InventoryWorkbench } from "@/components/blocks/InventoryWorkbench"

/** What the agent workbench route hands the slot. */
interface InventoryWorkbenchPageProps {
    /** `?tab=` from the route (stock, orders, suppliers, history, recipes, count, import); anything else opens the first tab. */
    readonly tab?: string | null
    /** The id of the installation the workbench is opened for, from the route. */
    readonly installationId?: string
}

/** The Inventory workbench slot: a thin server shell that mounts the connected client block. */
export const InventoryWorkbenchPage = (props: InventoryWorkbenchPageProps) => (
    <InventoryWorkbench initialTab={props.tab ?? null} installationId={props.installationId ?? null} />
)
