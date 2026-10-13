"use client"

import { useMemo } from "react"
import type { ShiftsBenchView } from "@/modules/types"
import { weekModelOf } from "./shiftsCoverage.shared"
import type { ShiftsWeekModel } from "./shiftsCoverage.shared"

/** The derived facts of the week (rule breaks, coverage, wages) with the pending reassignments applied. */
export const useShiftsWeekModel = (
    bench: ShiftsBenchView,
    moves: Readonly<Record<string, string | null>>,
): ShiftsWeekModel => useMemo(() => weekModelOf(bench, moves), [bench, moves])
