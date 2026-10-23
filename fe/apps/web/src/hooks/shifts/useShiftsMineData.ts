"use client"

import { useMemo } from "react"
import { useQueryShiftsMineSwr } from "@/hooks/swr"
import type { ShiftsMineView } from "@/modules/types"
import { toMineView } from "./shifts.shared"
import { readError } from "@/hooks/workspaceread"

/** What {@link useShiftsMineData} hands to the "my schedule" view. */
interface ShiftsMineData {
    readonly data: ShiftsMineView | undefined
    readonly error: unknown
    readonly isLoading: boolean
}

/** The `shiftsMine` query as the view of the signed-in person. */
export const useShiftsMineData = (): ShiftsMineData => {
    const swrRead = useQueryShiftsMineSwr()
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    const mine = useMemo(() => (data === undefined ? undefined : toMineView(data)), [data])
    return { data: mine, error, isLoading }
}
