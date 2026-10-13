"use client"

import { useMemo } from "react"
import { useQueryShiftsMineSwr } from "@/hooks/swr/api/graphql/queries/useQueryShiftsMineSwr"
import type { ShiftsMineView } from "@/modules/types"
import { toMineView } from "./shifts.shared"

/** What {@link useShiftsMineData} hands to the "my schedule" view. */
interface ShiftsMineData {
    readonly data: ShiftsMineView | undefined
    readonly error: unknown
    readonly isLoading: boolean
}

/** The `shiftsMine` query as the view of the signed-in person. */
export const useShiftsMineData = (): ShiftsMineData => {
    const { data, error, isLoading } = useQueryShiftsMineSwr()
    const mine = useMemo(() => (data === undefined ? undefined : toMineView(data)), [data])
    return { data: mine, error, isLoading }
}
