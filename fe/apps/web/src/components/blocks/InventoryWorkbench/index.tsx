"use client"
import { useInventoryWorkbenchView } from "@/hooks/inventoryWorkbench"
import { InventoryWorkbenchBase } from "./component"
/** The required installation and server-resolved Inventory route inputs. */
type InventoryWorkbenchProps = Parameters<typeof useInventoryWorkbenchView>[0]
/** Connects the inventory scenario to its own atomic drawing. */
export const InventoryWorkbench = (props: InventoryWorkbenchProps) => {
    const view = useInventoryWorkbenchView(props)
    return <InventoryWorkbenchBase {...view} />
}
