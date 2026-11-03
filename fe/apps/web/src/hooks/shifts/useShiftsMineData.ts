"use client"

import { useMemo } from "react"
import { useQueryShiftsMineSwr } from "@/hooks/swr"
import { toMineView } from "./shifts.shared"
import { readError } from "@/hooks/workspaceread"

import type { ShiftsMineView } from "@/modules/types"
import type { KeyedMutator } from "swr"

type UseShiftsMineDataResult = {
    data: ShiftsMineView | undefined
    error: unknown
    isLoading: boolean
    isValidating: boolean
    mutate: KeyedMutator<{
        profileId: string | null
        today: string
        availability: Array<{
            available: boolean
            createdAt: string
            date: string | null
            end: string
            id: string
            note: string
            staffId: string
            start: string
            status: string
            weekday: number | null
        }>
        colleagues: Array<{
            id: string
            name: string
            positionIds: Array<string>
        }>
        leaves: Array<{
            createdAt: string
            from: string
            id: string
            reason: string
            staffId: string
            status: string
            to: string
            workItemId: string | null
            item: {
                decidedPath: string | null
                id: string
                resultSummary: string | null
                status: string
                summary: string
            } | null
        }>
        myShifts: Array<{
            checkedIn: boolean
            date: string
            end: string
            id: string
            positionId: string
            staffId: string | null
            start: string
            status: string
        }>
        openShifts: Array<{
            date: string
            end: string
            id: string
            positionId: string
            staffId: string | null
            start: string
            status: string
        }>
        swaps: Array<{
            checks: Array<string>
            createdAt: string
            fromStaffId: string | null
            id: string
            kind: string
            reason: string
            shiftId: string
            shiftLine: string
            status: string
            toStaffId: string
            workItemId: string | null
            item: {
                decidedPath: string | null
                id: string
                resultSummary: string | null
                status: string
                summary: string
            } | null
        }>
    }>
}

/** The `shiftsMine` query as the view of the signed-in person. */
export const useShiftsMineData = (isActive = true): UseShiftsMineDataResult => {
    const swrRead = useQueryShiftsMineSwr(isActive)
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    const mine = useMemo(() => (data === undefined ? undefined : toMineView(data)), [data])
    return { data: mine, error, isLoading, isValidating: swrRead.isValidating, mutate: swrRead.mutate }
}
