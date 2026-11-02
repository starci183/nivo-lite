"use client"
import { useTranslations } from "next-intl"
import { MOVE_STAGES, scoreTone, hiringRejectCopyOf, useHiringFormat, useHiringSay } from "@/hooks/hiring"
import { ALL_JOBS, useHiringPipeline, useHiringReject } from "@/hooks/hiringPipeline"
import type { PipelineLane } from "@/hooks/hiringPipeline"
import { useHiringBenchStore } from "@/hooks/zustand/hiringBench"
import type { CandidateView } from "@/hooks/hiringWire"
import type { HiringViewInput } from "./hiringWorkbench.shared"

/** The resolved heading and cards in one stage. */
const laneOf = (
    lane: PipelineLane,
    t: ReturnType<typeof useTranslations<"hiring">>,
    cardOf: (candidate: CandidateView) => ReturnType<typeof candidateCardOf>,
) => ({
    stage: lane.stage,
    label: t(`stage_${lane.stage}`),
    count: String(lane.candidates.length),
    cards: lane.candidates.map(cardOf),
})

/** Locale and current job context used to resolve one candidate's display facts. */
interface PipelineCardContext {
    readonly jobId: string
    readonly titles: ReadonlyMap<string, string>
    readonly t: ReturnType<typeof useTranslations<"hiring">>
    readonly format: ReturnType<typeof useHiringFormat>
    readonly nowIso: string
}

/** Resolves the original score, source/date metadata, suggestion and allowed move options of one candidate. */
const candidateCardOf = (candidate: CandidateView, context: PipelineCardContext) => {
    const { jobId, titles, t, format, nowIso } = context
    return {
        id: candidate.id,
        name: candidate.name,
        scoreLabel: candidate.score === null ? t("pipeNotScored") : t("pipeScore", { score: candidate.score }),
        scoreTone: scoreTone(candidate.scoreLabel),
        meta: [
            jobId === ALL_JOBS ? titles.get(candidate.jobId) : undefined,
            format.label("source", candidate.source),
            format.ago(candidate.createdAt, nowIso),
        ]
            .filter((part) => part !== undefined && part !== "")
            .join(" · "),
        suggestion:
            candidate.scoreLabel === null ? null : t("pipeSuggestion", { label: t(`score_${candidate.scoreLabel}`) }),
        moveOptions: MOVE_STAGES.filter((stage) => stage !== candidate.stage).map((stage) => ({
            id: stage,
            label: t(`stage_${stage}`),
        })),
    }
}
/** Owns HiringPipeline's resolved data, commands and actual panel activation. */
export const useHiringPipelineView = (input: HiringViewInput) => {
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
    const cardOf = (candidate: CandidateView) => candidateCardOf(candidate, cardContext)

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
        lanes: pipeline.lanes.map((lane) => laneOf(lane, t, cardOf)),
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
