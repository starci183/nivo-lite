"use client"
import { useTranslations } from "next-intl"
import { focusedCandidateId, stageTone, useHiringFormat } from "@/hooks/hiring"
import { candidateDetailsOf, candidateCvOf, candidateHistoryOf, useHiringCandidate } from "@/hooks/hiringCandidate"
import { NO_CANDIDATE } from "@/hooks/hiringMap"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { useHiringBenchStore } from "@/hooks/zustand/hiringBench"
import type { HiringViewInput } from "./hiringWorkbench.shared"
import { useHiringCandidateDialogsView } from "./useHiringCandidateDialogsView"

/** One selected candidate owns its detail read and dialogs while the original overview is mounted. */
export const useHiringCandidateView = (input: HiringViewInput) => {
    const data = input.board
    const { openId, close } = useHiringBenchStore()
    const wanted = openId === undefined ? focusedCandidateId(data, input.focus) : openId
    const candidate = data.candidates.find((candidate) => candidate.id === wanted) ?? NO_CANDIDATE
    const t = useTranslations("hiring")
    const format = useHiringFormat()
    const labels = useSlotLabels()
    const owner = {
        isActive: input.isActive && input.isReady && candidate.id !== "",
        scope: JSON.stringify([input.scope, candidate.id]),
    }
    const view = useHiringCandidate(candidate, data, close, owner)
    const dialogs = useHiringCandidateDialogsView({
        candidate,
        data,
        copy: input.copy,
        owner,
        onClose: view.closeDialog,
    })
    const frame = {
        copy: input.copy,
        isOpen: candidate.id !== "",
        name: candidate.name,
        subtitle: [view.job?.title ?? "", format.label("source", candidate.source)]
            .filter((part) => part !== "")
            .join(" · "),
        stageLabel: t(`stage_${candidate.stage}`),
        stageTone: stageTone(candidate.stage),
        contacts: [candidate.phone, candidate.email].filter((line) => line !== ""),
        canSchedule: !view.isClosed && !view.hasOpenInterview,
        canOffer: !view.isClosed && !view.hasOpenOffer,
        canShortlist: candidate.stage === "applied" || candidate.stage === "screening",
        canReject: !view.isClosed,
        ...candidateDetailsOf(candidate, view, format, t),
        notes: view.notes,
        canSaveNotes: view.notes !== candidate.notes,
        retention: t("candRetention", { days: view.retentionDays }),
        isBusy: view.isPending,
        error: view.error,
        notice: view.notice,
        isDeleteOpen: view.dialog === "delete",
        deleteTitle: t("deleteTitle", { name: candidate.name }),
    }
    return {
        props: {
            frame,
            dialog: view.dialog,
            dialogs: dialogs.props,
            cv: {
                slot: mapSlot(view.detailSlot, (detail) => candidateCvOf(detail, view.showCv, t)),
                labels: labels(input.copy.candCvNone),
            },
            hasNoCv: candidate.cvPath === null,
            history: {
                slot: mapSlot(view.detailSlot, (detail) => candidateHistoryOf(detail, format)),
                labels: labels(input.copy.candNoHistory),
            },
        },
        on: {
            frame: {
                openDialog: view.openDialog,
                shortlist: view.shortlist,
                rescreen: view.rescreen,
                notes: view.setNotes,
                saveNotes: view.saveNotes,
                cancelOffer: view.cancelOffer,
                remove: view.remove,
                clear: view.clear,
                close,
                closeDialog: dialogs.on.close,
            },
            dialogs: dialogs.on,
            toggleCv: view.toggleCv,
            retryDetail: view.retryDetail,
        },
    }
}
