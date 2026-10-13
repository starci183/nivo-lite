import { useMemo, useState } from "react"
import { useHiringCopy, useHiringRun } from "@/hooks/hiring"
import type { HiringWorkbenchData } from "@/hooks/hiringWire"
import { proposedOf, weekDays } from "./hiringInterviews.shared"
import { useHiringInterviewCommands } from "./useHiringInterviewCommands"

/** The interview calendar: the week being looked at, the invitations waiting, the status commands and the copied link. */
export const useHiringInterviews = (data: HiringWorkbenchData) => {
    const run = useHiringRun()
    const commands = useHiringInterviewCommands()
    const { copiedId, copy } = useHiringCopy()
    const [week, setWeek] = useState(0)
    const days = useMemo(() => weekDays(data.nowIso, week, data.interviews), [data.nowIso, week, data.interviews])
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
        setStatus: (id: string, status: string) => void run.exec(() => commands.setStatus(id, status)),
        copyLink: (id: string, link: string) => void copy(id, link),
    }
}
