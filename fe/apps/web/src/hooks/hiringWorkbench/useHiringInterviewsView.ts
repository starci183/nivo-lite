"use client"
import { useTranslations } from "next-intl"
import { useHiringFormat } from "@/hooks/hiring"
import { useHiringInterviews } from "@/hooks/hiringInterviews"
import { useHiringBenchStore } from "@/hooks/zustand/hiringBench"
import type { InterviewView } from "@/hooks/hiringWire"
import type { HiringViewInput } from "./hiringWorkbench.shared"

type ResolvedActions = {
    readonly previousWeek: () => void
    readonly nextWeek: () => void
    readonly thisWeek: () => void
    readonly open: (candidateId: string) => void
    readonly status: (id: string, status: string) => void
    readonly copy: (id: string) => void
    readonly clearError: () => void
}

/** Owns HiringInterviews's resolved data, commands and actual panel activation. */
export const useHiringInterviewsView = (input: HiringViewInput) => {
    const owner = { isActive: input.isActive && input.isReady, scope: input.scope }

    const t = useTranslations("hiring")
    const format = useHiringFormat()
    const data = input.board
    const { open } = useHiringBenchStore()
    const view = useHiringInterviews(data, owner)
    const names = new Map(data.candidates.map((candidate) => [candidate.id, candidate.name]))
    const titles = new Map(data.jobs.map((job) => [job.id, job.title]))
    const nameOf = (interview: InterviewView): string => names.get(interview.candidateId) ?? t("candidateFallback")
    const rowOf = (interview: InterviewView) => ({
        id: interview.id,
        candidateId: interview.candidateId,
        title:
            interview.slotStart === null
                ? nameOf(interview)
                : `${format.time(interview.slotStart)} · ${nameOf(interview)}`,
        meta: [
            titles.get(interview.jobId),
            interview.interviewerName,
            interview.mode === "online" ? t("ivMode_online") : interview.location,
        ]
            .filter((part) => part !== undefined && part !== "")
            .join(" · "),
        isConfirmed: interview.status === "confirmed",
    })
    const first = view.days[0]
    const last = view.days.at(-1)
    const range =
        first === undefined || last === undefined
            ? ""
            : `${format.date(first.startIso)} - ${format.date(last.startIso)}`

    const props = {
        copy: input.copy,
        weekLabel: view.week === 0 ? t("ivThisWeek", { range }) : range,
        isThisWeek: view.week === 0,
        days: view.days.map((day) => ({
            key: day.date,
            label: format.dayLabel(day.startIso),
            isToday: day.isToday && view.week === 0,
            items: day.items.map(rowOf),
        })),
        invitations: view.proposed.map((interview) => ({
            ...rowOf(interview),
            title: nameOf(interview),
            badge: t(interview.note === "" ? "ivStatus_proposed" : "ivNoFit"),
            meta: [titles.get(interview.jobId), interview.interviewerName]
                .filter((part) => part !== undefined && part !== "")
                .join(" · "),
            proposed: t("ivProposed", {
                times: interview.slots.map((slot) => format.dateTime(slot.start)).join("; "),
            }),
            note: interview.note === "" ? null : t("ivNoFitNote", { note: interview.note }),
            copyLabel: t(view.copiedId === interview.id ? "copiedLink" : "ivCopyLink"),
        })),
        invitationsFact: t("ivInvitations", { n: view.proposed.length }),
        isBusy: view.isPending,
        error: view.error,
    }
    const on: ResolvedActions = {
        previousWeek: view.previousWeek,
        nextWeek: view.nextWeek,
        thisWeek: view.thisWeek,
        open,
        status: view.setStatus,
        copy: (id) => {
            const interview = data.interviews.find((entry) => entry.id === id)
            if (interview !== undefined) view.copyLink(id, `${data.origin}/j/lich/${interview.token}`)
        },
        clearError: view.clearError,
    }
    return { props, on }
}
