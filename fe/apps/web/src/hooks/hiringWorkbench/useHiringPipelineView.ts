"use client"
import { useTranslations } from "next-intl"
import { hiringRejectCopyOf, useHiringFormat, useHiringSay } from "@/hooks/hiring"
import { ALL_JOBS, useHiringPipeline, useHiringReject } from "@/hooks/hiringPipeline"
import { useHiringBenchStore } from "@/hooks/zustand/hiringBench"
import type { CandidateView } from "@/hooks/hiringWire"
import { pipelineCardOf, pipelineLaneOf, type HiringViewInput } from "./hiringWorkbench.shared"
import type { BadgeTone } from "@starci/grammar/common"
import type { Dispatch, SetStateAction } from "react"

/** The view `useHiringPipelineView` returns. */
export interface HiringPipelineViewShape {
    props: {
        copy: {
            title: string
            jobLabel: string
            moveFailed: string
            dismissLabel: string
            emptyTitle: string
            emptyBody: string
            boardLabel: string
            laneEmpty: string
            openLabel: string
            moveToLabel: string
            movePlaceholder: string
        }
        jobId: string
        jobOptions: {
            id: string
            label: string
        }[]
        lanes: {
            stage: string
            label: string
            count: string
            cards: {
                id: string
                name: string
                scoreLabel: string
                scoreTone: BadgeTone
                meta: string
                suggestion: string | null
                moveOptions: {
                    id: string
                    label: string
                }[]
            }[]
        }[]
        hasNoCandidates: boolean
        withdrawnNote: string | null
        dragId: string | null
        overStage: string | null
        isBusy: boolean
        error: string | null
        isRejectOpen: boolean
        reject: {
            copy: {
                title: string
                closeLabel: string
                hint: string
                failed: string
                reasonLabel: string
                kept: string
                cancelLabel: string
                confirmLabel: string
            }
            reason: string
            canConfirm: boolean
            isBusy: boolean
            error: string | null
        }
    }
    on: {
        board: {
            job: (id: string) => void
            open: (candidateId: string) => void
            move: (id: string, stage: string) => void
            dragStart: (id: string) => void
            dragEnd: () => void
            dragOver: (stage: string) => void
            dragLeave: (stage: string) => void
            drop: (stage: string, transferId: string) => void
            clearError: () => void
        }
        reject: {
            reason: Dispatch<SetStateAction<string>>
            confirm: () => void
            close: () => void
        }
    }
}

/** Owns HiringPipeline's resolved data, commands and actual panel activation. */
export const useHiringPipelineView = (input: HiringViewInput): HiringPipelineViewShape => {
    const owner = { isActive: input.isActive && input.isReady, scope: input.scope }

    const t = useTranslations("hiring")
    const say = useHiringSay()
    const format = useHiringFormat()
    const data = input.board
    const { jobId, setJobId, open } = useHiringBenchStore()
    const pipeline = useHiringPipeline(data, jobId, owner)
    const reject = useHiringReject(pipeline.closeReject, owner)
    const titles = new Map(data.jobs.map((job) => [job.id, job.title]))
    const closeReject = () => {
        reject.reset()
        pipeline.closeReject()
    }
    const cardContext = { jobId, titles, t, format, nowIso: data.nowIso }
    const cardOf = (candidate: CandidateView) => pipelineCardOf(candidate, cardContext)

    const props = {
        copy: {
            title: say("pipeTitle"),
            jobLabel: say("pipeJob"),
            moveFailed: say("pipeMoveFailed"),
            dismissLabel: say("dismiss"),
            emptyTitle: say("pipeEmptyTitle"),
            emptyBody: say("pipeEmptyBody"),
            boardLabel: say("pipeBoard"),
            laneEmpty: say("pipeLaneEmpty"),
            openLabel: say("pipeOpen"),
            moveToLabel: say("pipeMoveTo"),
            movePlaceholder: say("pipeMovePlaceholder"),
        },
        jobId,
        jobOptions: [
            { id: ALL_JOBS, label: t("pipeAllJobs") },
            ...data.jobs.map((job) => ({ id: job.id, label: job.title })),
        ],
        lanes: pipeline.lanes.map((lane) => pipelineLaneOf(lane, t, cardOf)),
        hasNoCandidates: data.candidates.length === 0,
        withdrawnNote: pipeline.withdrawn > 0 ? t("pipeWithdrawn", { n: pipeline.withdrawn }) : null,
        dragId: pipeline.dragId,
        overStage: pipeline.overStage,
        isBusy: pipeline.isPending,
        error: pipeline.error,
        isRejectOpen: pipeline.rejecting !== null,
        reject: {
            copy: hiringRejectCopyOf(say, pipeline.rejecting?.name ?? ""),
            reason: reject.reason,
            canConfirm: reject.canConfirm,
            isBusy: reject.isPending,
            error: reject.error,
        },
    }
    const on = {
        board: {
            job: setJobId,
            open,
            move: pipeline.moveTo,
            dragStart: pipeline.startDrag,
            dragEnd: pipeline.endDrag,
            dragOver: pipeline.overLane,
            dragLeave: pipeline.leaveLane,
            drop: pipeline.dropOn,
            clearError: pipeline.clearError,
        },
        reject: {
            reason: reject.setReason,
            confirm: () => {
                if (pipeline.rejecting !== null) reject.confirm(pipeline.rejecting.id)
            },
            close: closeReject,
        },
    }
    return { props, on }
}
