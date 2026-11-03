"use client"

import { useMemo } from "react"
import { mapSlot, slotOfSwr } from "@/hooks/slot"
import { useQuerySalesWorkbenchSwr } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { salesWorkbenchViewOf } from "@/modules/sales"

import type { DataSlot, SalesWorkbenchData } from "@/modules/types"

/** The clock the workbench falls back to while it has not been read: the tabs that need it show no rows yet. */
const NOT_READ_ISO = new Date(0).toISOString()

type UseSalesWorkbenchResult = {
    /** The workbench as one data slot: loading, failed, or its items. */
    slot: DataSlot<SalesWorkbenchData>
    /** Everything the workbench shows; null while loading or when the read failed. */
    data: SalesWorkbenchData | null
    nowIso: string
    isLoading: boolean
    /** The read failed. */
    isFailed: boolean
    retry: () => void
}

/** The Sales workbench of the active workspace, read once through the shared SWR cache and mapped to the display model. */
export const useSalesWorkbench = (isActive = true): UseSalesWorkbenchResult => {
    const { activeWorkspaceId } = useActiveWorkspace()
    const query = useQuerySalesWorkbenchSwr(isActive ? activeWorkspaceId : undefined)
    const data = useMemo(() => (query.data === undefined ? null : salesWorkbenchViewOf(query.data)), [query.data])
    const slot = mapSlot(slotOfSwr(query), salesWorkbenchViewOf)
    return {
        /** The workbench as one data slot: loading, failed, or its items. */
        slot,
        /** Everything the workbench shows; null while loading or when the read failed. */
        data,
        nowIso: data?.nowIso ?? NOT_READ_ISO,
        isLoading: query.isLoading,
        /** The read failed. */
        isFailed: query.error !== undefined,
        retry: (): void => {
            void query.mutate()
        },
    }
}
