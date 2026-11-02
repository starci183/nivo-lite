import { InventoryWorkbench } from "@/components/blocks/InventoryWorkbench"

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
/** Draws the single connected Inventory workbench from the server-resolved route atoms. */
export const InventoryWorkbenchPageBase = (props: InventoryWorkbenchPageBaseProps) => (
    <InventoryWorkbench {...props.props} />
)
