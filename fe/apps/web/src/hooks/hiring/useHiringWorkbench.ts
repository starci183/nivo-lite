"use client"

import type { SlotRead, DataSlot } from "@/modules/types"

import { useMemo } from "react"
import { EMPTY_BOARD, toHiringWorkbenchData } from "@/hooks/hiringMap"
import { useQueryHiringWorkbenchSwr } from "@/hooks/swr"
import { isForbiddenFailure } from "@/modules/failure"
import { readError } from "@/hooks/workspaceread"
import { slotOfSwr } from "@/hooks/slot"
import type { HiringWorkbenchData } from "@/hooks/hiringWire"

/** The Hiring workbench as the back end sends it. */
type HiringWorkbenchWire = NonNullable<ReturnType<typeof useQueryHiringWorkbenchSwr>["data"]>

/** The view `useHiringWorkbench` returns. */
export interface HiringWorkbenchViewShape {
    read: SlotRead<HiringWorkbenchData | undefined>
    slot: DataSlot<HiringWorkbenchData | undefined>
    board: HiringWorkbenchData
    hasBoard: boolean
    isLoading: boolean
    isFailed: boolean
    isForbidden: boolean
    reload: () => Promise<HiringWorkbenchWire | undefined>
}

/**
 * The Hiring workbench through SWR, shared by every tab block (one cache entry). `board` is the empty board until the first read
 * lands, so a block can always draw; `isLoading`, `isFailed` and `isForbidden` (not an owner or a manager) say why it is empty.
 */
export const useHiringWorkbench = (isActive = true): HiringWorkbenchViewShape => {
    const swrRead = useQueryHiringWorkbenchSwr(isActive)
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    const mapped = useMemo(() => (data === undefined ? undefined : toHiringWorkbenchData(data)), [data])
    const read: SlotRead<typeof mapped> = {
        data: mapped,
        error: swrRead.error,
        isLoading: swrRead.isLoading,
        isValidating: swrRead.isValidating,
    }
    return {
        read,
        slot: slotOfSwr(read),
        board: mapped ?? EMPTY_BOARD,
        hasBoard: mapped !== undefined,
        isLoading,
        isFailed: error !== undefined,
        isForbidden: isForbiddenFailure(error),
        reload: () => swrRead.mutate(),
    }
}
