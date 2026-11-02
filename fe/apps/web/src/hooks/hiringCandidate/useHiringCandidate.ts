"use client"

import { slotOfSwr } from "@/hooks/slot"
import type { SlotRead, HiringViews } from "@/modules/types"
import { useFeatureReset, useFeatureLifetime } from "@/hooks/reuseables"

import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import {
    CLOSED_STAGES,
    OPEN_INTERVIEW_STATUSES,
    OPEN_OFFER_STATUSES,
    useHiringRun,
    type HiringOwner,
} from "@/hooks/hiring"
import { toCandidateDetail } from "@/hooks/hiringMap"
import type { CandidateView, HiringWorkbenchData } from "@/hooks/hiringWire"
import { useHiringMove } from "@/hooks/hiringPipeline"
import { useQueryHiringCandidateDetailSwr } from "@/hooks/swr"
import { useHiringCandidateCommands } from "./useHiringCandidateCommands"

/** The candidate drawer: the candidate's detail (CV link, timeline), the notes being typed, the open dialog and every command. */
export const useHiringCandidate = (
    candidate: CandidateView,
    data: HiringWorkbenchData,
    onClose: () => void,
    owner?: HiringOwner,
) => {
    const t = useTranslations("hiring")
    const run = useHiringRun(owner)
    const lifetime = useFeatureLifetime(owner?.isActive ?? true, owner?.scope ?? "")
    const commands = useHiringCandidateCommands()
    const move = useHiringMove()
    const detailRead = useQueryHiringCandidateDetailSwr(
        candidate.id === "" || owner?.isActive === false ? undefined : { id: candidate.id },
    )
    const [typed, setTyped] = useState<{ readonly id: string; readonly text: string } | null>(null)
    const notes = typed !== null && typed.id === candidate.id ? typed.text : candidate.notes
    const [showCv, setShowCv] = useState(false)
    const [dialog, setDialog] = useState<HiringViews["candidateDialog"] | null>(null)
    const detail = useMemo(
        () => (detailRead.data === undefined ? undefined : toCandidateDetail(detailRead.data)),
        [detailRead.data],
    )
    const read: SlotRead<NonNullable<typeof detail>> = {
        data: detail,
        error: detailRead.error,
        isLoading: detailRead.isLoading,
        isValidating: detailRead.isValidating,
    }
    const relations = candidateRelationsOf(candidate, data)
    useFeatureReset({
        isActive: owner?.isActive ?? true,
        isReady: true,
        scope: owner?.scope ?? "",
        onReset: () => {
            setTyped(null)
            setShowCv(false)
            setDialog(null)
        },
    })
    return {
        detail,
        detailSlot: slotOfSwr(read),
        retryDetail: () => detailRead.mutate(),
        ...relations,
        notes,
        setNotes: (text: string) => setTyped({ id: candidate.id, text }),
        showCv,
        toggleCv: () => setShowCv((current) => !current),
        dialog,
        openDialog: setDialog,
        closeDialog: () => setDialog(null),
        isPending: run.isPending,
        error: run.error,
        notice: run.notice,
        clear: run.clear,
        shortlist: () => run.dispatch(() => move(candidate.id, "shortlisted")),
        rescreen: () =>
            run.dispatch(
                () => commands.rescreen(candidate.id),
                (outcome) => (outcome.status === "done" ? t("candRescreened") : outcome.summary),
            ),
        saveNotes: () =>
            run.dispatch(
                () => commands.saveNotes(candidate.id, notes),
                () => t("candNotesSaved"),
            ),
        cancelOffer: (id: string) => run.dispatch(() => commands.cancelOffer(id)),
        remove: async () => {
            const isCurrent = lifetime.capture()
            if (!isCurrent()) throw new Error(t("errorNotSaved"))
            const removed = await run.exec(() => commands.remove(candidate.id))
            if (removed === undefined || !isCurrent()) throw new Error(t("errorNotSaved"))
            setDialog(null)
            onClose()
        },
    }
}

/** The actual related appointments, offers, position and available next steps of this candidate. */
const candidateRelationsOf = (candidate: CandidateView, data: HiringWorkbenchData) => {
    const interviews = data.interviews.filter((interview) => interview.candidateId === candidate.id)
    const offers = data.offers.filter((offer) => offer.candidateId === candidate.id)
    return {
        interviews,
        offers,
        job: data.jobs.find((job) => job.id === candidate.jobId),
        retentionDays: data.settings.retentionDays,
        isClosed: CLOSED_STAGES.includes(candidate.stage),
        hasOpenInterview: interviews.some((interview) => OPEN_INTERVIEW_STATUSES.includes(interview.status)),
        hasOpenOffer: offers.some((offer) => OPEN_OFFER_STATUSES.includes(offer.status)),
    }
}
