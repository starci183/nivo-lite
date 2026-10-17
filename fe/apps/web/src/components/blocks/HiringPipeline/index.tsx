"use client"

import { useTranslations } from "next-intl"
import { MOVE_STAGES, scoreTone, useHiringFormat, useHiringSay, useHiringWorkbench } from "@/hooks/hiring"
import { ALL_JOBS, useHiringPipeline, useHiringReject } from "@/hooks/hiringPipeline"
import type { PipelineLane } from "@/hooks/hiringPipeline"
import { useHiringBenchStore } from "@/hooks/zustand/hiringBench"
import type { CandidateView } from "@/hooks/hiringWire"
import { HiringPipelineBase } from "./component"
import type { HiringPipelineBaseProps } from "./component"

/** The connected candidates tab: the pipeline of one job (or all) and the moves between its stages. */
export const HiringPipeline = () => {
    const t = useTranslations("hiring")
    const say = useHiringSay()
    const format = useHiringFormat()
    const { board: data } = useHiringWorkbench()
    const { jobId, setJobId, open } = useHiringBenchStore()
    const pipeline = useHiringPipeline(data, jobId)
    const reject = useHiringReject(pipeline.closeReject)
    const titles = new Map(data.jobs.map((job) => [job.id, job.title]))
    const closeReject = () => {
        reject.reset()
        pipeline.closeReject()
    }
    const cardOf = (candidate: CandidateView) => ({
        id: candidate.id,
        name: candidate.name,
        scoreLabel: candidate.score === null ? t("pipeNotScored") : t("pipeScore", { score: candidate.score }),
        scoreTone: scoreTone(candidate.scoreLabel),
        meta: [
            jobId === ALL_JOBS ? titles.get(candidate.jobId) : undefined,
            format.label("source", candidate.source),
            format.ago(candidate.createdAt, data.nowIso),
        ]
            .filter((part) => part !== undefined && part !== "")
            .join(" · "),
        suggestion:
            candidate.scoreLabel === null ? null : t("pipeSuggestion", { label: t(`score_${candidate.scoreLabel}`) }),
        moveOptions: MOVE_STAGES.filter((stage) => stage !== candidate.stage).map((stage) => ({
            id: stage,
            label: t(`stage_${stage}`),
        })),
    })
    return (
        <HiringPipelineBase
            props={{
                say,
                jobId,
                jobOptions: [
                    { id: ALL_JOBS, label: t("pipeAllJobs") },
                    ...data.jobs.map((job) => ({ id: job.id, label: job.title })),
                ],
                lanes: pipeline.lanes.map((lane) => laneOf(lane, t, cardOf)),
                hasNoCandidates: data.candidates.length === 0,
                withdrawnNote: pipeline.withdrawn > 0 ? t("pipeWithdrawn", { n: pipeline.withdrawn }) : null,
                overStage: pipeline.overStage,
                isBusy: pipeline.isPending,
                error: pipeline.error,
                isRejectOpen: pipeline.rejecting !== null,
                reject: {
                    say,
                    name: pipeline.rejecting?.name ?? "",
                    reason: reject.reason,
                    canConfirm: reject.canConfirm,
                    isBusy: reject.isPending,
                    error: reject.error,
                },
            }}
            on={{
                job: setJobId,
                open,
                move: pipeline.moveTo,
                dragStart: pipeline.startDrag,
                dragEnd: pipeline.endDrag,
                dragOver: pipeline.overLane,
                dragLeave: pipeline.leaveLane,
                drop: pipeline.dropOn,
                clearError: pipeline.clearError,
                rejectReason: reject.setReason,
                confirmReject: () => {
                    if (pipeline.rejecting !== null) void reject.confirm(pipeline.rejecting.id)
                },
                closeReject,
            }}
        />
    )
}

/** The resolved heading and cards in one stage. */
const laneOf = (
    lane: PipelineLane,
    t: ReturnType<typeof useTranslations<"hiring">>,
    cardOf: (candidate: CandidateView) => HiringPipelineBaseProps["props"]["lanes"][number]["cards"][number],
) => ({
    stage: lane.stage,
    label: t(`stage_${lane.stage}`),
    count: String(lane.candidates.length),
    cards: lane.candidates.map(cardOf),
})
