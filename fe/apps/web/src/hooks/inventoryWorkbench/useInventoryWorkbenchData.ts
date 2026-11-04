import { mapSlot, slotOfSwr } from "@/hooks/slot"
import { useQueryInventoryWorkbenchSwr } from "@/hooks/swr"
import { toInventoryWorkbenchData } from "@/modules/inventory"
import { readError } from "@/hooks/workspaceread"
import type { SWRResponse } from "swr"
import type { DataSlot, InventoryWorkbenchData } from "@/modules/types"

/** The inventory workbench as the back end sends it. */
export interface InventoryWorkbenchWire {
    canManage: boolean
    defaultLocationId: string | null
    nowIso: string
    stockOuts7d: number | null
    items: Array<{
        active: boolean
        aliases: Array<string>
        category: string
        costVnd: number
        id: string
        name: string
        onOrder: number
        reorderPoint: number
        reorderQty: number
        sellPriceVnd: number | null
        sku: string
        status: string
        supplierId: string | null
        total: number
        unit: string
        levels: Array<{
            locationId: string
            qty: number
        }>
        units: Array<{
            factor: number
            unit: string
        }>
    }>
    locations: Array<{
        id: string
        name: string
    }>
    metrics: {
        itemCount: number
        lowCount: number
        openPos: number
        outCount: number
        pendingCount: number
        valueVnd: number
    }
    movements: Array<{
        byName: string
        createdAt: string
        evidence: string
        id: string
        itemName: string
        kind: string
        qty: number
        qtyAfter: number
        reason: string
        refLabel: string
        unit: string
    }>
    pending: Array<{
        action: string
        createdAt: string
        draft: string | null
        id: string
        poId: string | null
        summary: string
    }>
    pos: Array<{
        channel: string | null
        createdAt: string
        expectedAt: string | null
        id: string
        message: string
        poNo: string
        reminders: number
        sendNote: string | null
        sentVia: string | null
        source: string
        status: string
        supplierId: string | null
        supplierName: string
        totalVnd: number
        workItemId: string | null
        lines: Array<{
            id: string
            itemId: string
            name: string
            qtyOrdered: number
            qtyReceived: number
            unit: string
            unitCost: number
        }>
    }>
    recipes: Array<{
        aliases: Array<string>
        id: string
        name: string
        lines: Array<{
            itemId: string
            name: string
            qty: number
            unit: string
        }>
    }>
    suppliers: Array<{
        channel: string
        contactName: string
        email: string
        id: string
        leadTimeDays: number
        name: string
        note: string
        paymentTerms: string
        phone: string
        zalo: string
    }>
}

/** The view `useInventoryWorkbenchData` returns. */
export interface InventoryWorkbenchDataViewShape {
    read: SWRResponse<InventoryWorkbenchWire>
    slot: DataSlot<InventoryWorkbenchData>
    data: InventoryWorkbenchData | undefined
    error: unknown
    isLoading: boolean
    reload: () => Promise<InventoryWorkbenchWire | undefined>
}

/**
 * The inventory workbench through SWR: `data` is `null` while the first read runs and `undefined` when it failed — the
 * connected block shows the failure notice in that case.
 */
export const useInventoryWorkbenchData = (isActive = true): InventoryWorkbenchDataViewShape => {
    const swrRead = useQueryInventoryWorkbenchSwr(isActive)
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    return {
        read: swrRead,
        slot: mapSlot(slotOfSwr(swrRead), toInventoryWorkbenchData),
        data: data === undefined ? undefined : toInventoryWorkbenchData(data),
        error,
        isLoading,
        reload: () => swrRead.mutate(),
    }
}
