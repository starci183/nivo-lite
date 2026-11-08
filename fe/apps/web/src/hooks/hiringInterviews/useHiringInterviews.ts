"use client"

import { useFeatureReset } from "@/hooks/reuseables"
import { type HiringOwner, useHiringCopy, useHiringRun } from "@/hooks/hiring"

import { useMemo, useState } from "react"
import type { HiringWorkbenchData, InterviewView } from "@/hooks/hiringWire"
import { proposedOf, weekDays, type CalendarDay } from "./hiringInterviews.shared"
import { useHiringInterviewCommands } from "./useHiringInterviewCommands"

/** The view `useHiringInterviews` returns. */
export interface HiringInterviewsView {
    week: number
    days: CalendarDay[]
    proposed: InterviewView[]
    copiedId: string | null
    isPending: boolean
    error: string | null
    clearError: () => void
    previousWeek: () => void
    nextWeek: () => void
    thisWeek: () => void
    setStatus: (id: string, status: string) => void
    copyLink: (id: string, link: string) => void
}

/** The interview calendar: the week being looked at, the invitations waiting, the status commands and the copied link. */
export const useHiringInterviews = (data: HiringWorkbenchData, owner?: HiringOwner): HiringInterviewsView => {
    const run = useHiringRun(owner)
    const commands = useHiringInterviewCommands()
    const { copiedId, copy } = useHiringCopy(owner)
    const [week, setWeek] = useState(0)
    const days = useMemo(() => weekDays(data.nowIso, week, data.interviews), [data.nowIso, week, data.interviews])
    useFeatureReset({
        isActive: owner?.isActive ?? true,
        isReady: true,
        scope: owner?.scope ?? "",
        onReset: () => {
            setWeek(0)
        },
    })
    return {
        week,
        days,
        proposed: useMemo(() => proposedOf(data.interviews), [data.interviews]),
        copiedId,
        isPending: run.isPending,
        error: run.error,
        clearError: run.clear,
        previousWeek: () => setWeek((current) => current - 1),
        nextWeek: () => setWeek((current) => current + 1),
        thisWeek: () => setWeek(0),
        setStatus: (id: string, status: string) => run.dispatch(() => commands.setStatus(id, status)),
        copyLink: (id: string, link: string) => copy(id, link),
    }
}
