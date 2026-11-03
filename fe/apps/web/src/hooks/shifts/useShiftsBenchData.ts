"use client"

import { useMemo } from "react"
import { useQueryShiftsWorkbenchSwr } from "@/hooks/swr"
import { toBenchView, toFiguresView } from "./shifts.shared"
import { readError } from "@/hooks/workspaceread"

import type { ShiftsBenchView, ShiftsFiguresView } from "@/modules/types"
import type { KeyedMutator } from "swr"

type UseShiftsBenchDataResult = {
    data: ShiftsBenchView | undefined
    figures: ShiftsFiguresView | null
    error: unknown
    isLoading: boolean
    isValidating: boolean
    mutate: KeyedMutator<{
        myProfileId: string | null
        reminderOn: boolean
        role: string
        today: string
        allAvailability: Array<{
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
        figures: {
            hoursMonth: number
            leavePending: number
            openGaps: number
            weekFilled: number
            weekHasSchedule: boolean
            weekTotal: number
        } | null
        requests: {
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
        }
        setup: {
            blocks: Array<{
                end: string
                id: string
                ideal: number
                min: number
                peak: boolean
                positionId: string
                start: string
                weekday: number
            }>
            positions: Array<{
                color: string
                id: string
                name: string
            }>
            settings: {
                leaveNoticeDays: number
                noshowMinutes: number
                overtimeHoursWeek: number
                remindMinutes: number
                swapNoticeHours: number
                openingHours: Array<{
                    close: string
                    open: string
                    weekday: number
                }>
            }
            staff: Array<{
                active: boolean
                id: string
                maxDay: number
                maxWeek: number
                minRest: number
                name: string
                phone: string | null
                positionIds: Array<string>
                skills: Array<string>
                staffRowId: string | null
                telegramChatId: string | null
                wage: number
                zaloUserId: string | null
            }>
        }
        staffRows: Array<{
            id: string
            name: string
        }>
        week: {
            monday: string
            approvedAvail: Array<{
                available: boolean
                date: string | null
                end: string
                staffId: string
                start: string
                weekday: number | null
            }>
            approvedLeaves: Array<{
                from: string
                staffId: string
                to: string
            }>
            checkins: Array<{
                checkedInAt: string
                shiftId: string
            }>
            current: {
                costVnd: number
                createdAt: string
                evidence: unknown
                explanation: string
                id: string
                publishedAt: string | null
                solverMs: number | null
                source: string
                status: string
                summary: unknown
                version: number
                weekStart: string
                workItemId: string | null
            } | null
            prior: Array<{
                staffId: string
                segs: Array<{
                    date: string
                    e: number
                    pos: string
                    s: number
                }>
            }>
            publishItem: {
                decidedPath: string | null
                id: string
                resultSummary: string | null
                status: string
                summary: string
            } | null
            shifts: Array<{
                date: string
                end: string
                id: string
                positionId: string
                staffId: string | null
                start: string
                status: string
            }>
            versions: Array<{
                costVnd: number
                createdAt: string
                id: string
                publishedAt: string | null
                status: string
                version: number
            }>
        }
    }>
}

/** The `shiftsWorkbench` query for one week (`null` = the week of today) as the view the panels render. */
export const useShiftsBenchData = (week: string | null, isActive = true): UseShiftsBenchDataResult => {
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
