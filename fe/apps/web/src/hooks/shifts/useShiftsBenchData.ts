"use client"

import { useMemo } from "react"
import { useQueryShiftsWorkbenchSwr } from "@/hooks/swr/api/graphql/queries/useQueryShiftsWorkbenchSwr"
import type { ShiftsBenchView, ShiftsFiguresView } from "@/modules/types"
import { toBenchView, toFiguresView } from "./shifts.shared"

/** What {@link useShiftsBenchData} hands to the workbench. */
interface ShiftsBenchData {
    /** The mapped workbench; `undefined` while the first read runs or after a failure (`error` is set then). */
    readonly data: ShiftsBenchView | undefined
    /** The ribbon's four figures; `null` for staff and for a failed figures read. */
    readonly figures: ShiftsFiguresView | null
    readonly error: unknown
    readonly isLoading: boolean
}

/** The `shiftsWorkbench` query for one week (`null` = the week of today) as the view the panels render. */
export const useShiftsBenchData = (week: string | null): ShiftsBenchData => {
    const { data, error, isLoading } = useQueryShiftsWorkbenchSwr(week === null ? {} : { week })
    const bench = useMemo(() => (data === undefined ? undefined : toBenchView(data)), [data])
    return {
        data: bench,
        figures: data?.figures === null || data?.figures === undefined ? null : toFiguresView(data.figures),
        error,
        isLoading,
    }
}
