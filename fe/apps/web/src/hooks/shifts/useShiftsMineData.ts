"use client"

import { useMemo } from "react"
import { useQueryShiftsMineSwr } from "@/hooks/swr"
import { toMineView } from "./shifts.shared"
import { readError } from "@/hooks/workspaceread"

/** The `shiftsMine` query as the view of the signed-in person. */
export const useShiftsMineData = (isActive = true) => {
    const swrRead = useQueryShiftsMineSwr(isActive)
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    const mine = useMemo(() => (data === undefined ? undefined : toMineView(data)), [data])
    return { data: mine, error, isLoading, isValidating: swrRead.isValidating, mutate: swrRead.mutate }
}
