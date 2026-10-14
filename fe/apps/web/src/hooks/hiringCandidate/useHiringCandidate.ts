"use client"

import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { CLOSED_STAGES, OPEN_INTERVIEW_STATUSES, OPEN_OFFER_STATUSES, useHiringRun } from "@/hooks/hiring"
import { toCandidateDetail } from "@/hooks/hiringMap"
import type { CandidateView, HiringWorkbenchData } from "@/hooks/hiringWire"
import { useHiringMove } from "@/hooks/hiringPipeline"
import { useQueryHiringCandidateDetailSwr } from "@/hooks/swr"
import type { CandidateDialog } from "./hiringCandidate.shared"
import { useHiringCandidateCommands } from "./useHiringCandidateCommands"

/** The candidate drawer: the candidate's detail (CV link, timeline), the notes being typed, the open dialog and every command. */
export const useHiringCandidate = (candidate: CandidateView, data: HiringWorkbenchData, onClose: () => void) => {
    const t = useTranslations("hiring")
    const run = useHiringRun()
    const commands = useHiringCandidateCommands()
    const move = useHiringMove()
    const detailRead = useQueryHiringCandidateDetailSwr(candidate.id === "" ? undefined : { id: candidate.id })
    const [typed, setTyped] = useState<{ readonly id: string; readonly text: string } | null>(null)
    const notes = typed !== null && typed.id === candidate.id ? typed.text : candidate.notes
    const [showCv, setShowCv] = useState(false)
    const [dialog, setDialog] = useState<CandidateDialog | null>(null)
    const detail = useMemo(
        () => (detailRead.data === undefined ? undefined : toCandidateDetail(detailRead.data)),
        [detailRead.data],
    )
    const interviews = data.interviews.filter((interview) => interview.candidateId === candidate.id)
    const offers = data.offers.filter((offer) => offer.candidateId === candidate.id)
    return {
        detail,
        interviews,
        offers,
        job: data.jobs.find((job) => job.id === candidate.jobId),
        retentionDays: data.settings.retentionDays,
        notes,
        setNotes: (text: string) => setTyped({ id: candidate.id, text }),
        showCv,
        toggleCv: () => setShowCv((current) => !current),
        dialog,
        openDialog: setDialog,
        closeDialog: () => setDialog(null),
        isClosed: CLOSED_STAGES.includes(candidate.stage),
        hasOpenInterview: interviews.some((interview) => OPEN_INTERVIEW_STATUSES.includes(interview.status)),
        hasOpenOffer: offers.some((offer) => OPEN_OFFER_STATUSES.includes(offer.status)),
        isPending: run.isPending,
        error: run.error,
        notice: run.notice,
        clear: run.clear,
        shortlist: () => void run.exec(() => move(candidate.id, "shortlisted")),
        rescreen: () =>
            void run.exec(
                () => commands.rescreen(candidate.id),
                (outcome) => (outcome.status === "done" ? t("candRescreened") : outcome.summary),
            ),
        saveNotes: () =>
            void run.exec(
                () => commands.saveNotes(candidate.id, notes),
                () => t("candNotesSaved"),
            ),
        cancelOffer: (id: string) => void run.exec(() => commands.cancelOffer(id)),
        remove: async () => {
            const removed = await run.exec(() => commands.remove(candidate.id))
            if (removed === undefined) return
            setDialog(null)
            onClose()
        },
    }
}
