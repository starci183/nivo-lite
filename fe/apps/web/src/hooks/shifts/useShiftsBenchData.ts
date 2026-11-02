"use client"

import { useMemo } from "react"
import { useQueryShiftsWorkbenchSwr } from "@/hooks/swr"
import { toBenchView, toFiguresView } from "./shifts.shared"
import { readError } from "@/hooks/workspaceread"

/** The `shiftsWorkbench` query for one week (`null` = the week of today) as the view the panels render. */
export const useShiftsBenchData = (week: string | null, isActive = true) => {
    const query = week === null ? {} : { week }
    const swrRead = useQueryShiftsWorkbenchSwr(isActive ? query : undefined)
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    const bench = useMemo(() => (data === undefined ? undefined : toBenchView(data)), [data])
    return {
        data: bench,
        figures: data?.figures === null || data?.figures === undefined ? null : toFiguresView(data.figures),
        error,
        isLoading,
        isValidating: swrRead.isValidating,
        mutate: swrRead.mutate,
    }
}
