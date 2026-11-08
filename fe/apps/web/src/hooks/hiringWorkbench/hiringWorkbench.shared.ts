import type { useTranslations } from "next-intl"
import { MOVE_STAGES, NEXT_JOB_STATUS, jobStatusTone, scoreTone, type useHiringFormat } from "@/hooks/hiring"
import { ALL_JOBS, type PipelineLane } from "@/hooks/hiringPipeline"
import type { useHiringJobAd } from "@/hooks/hiringJobs"
import type { HiringViews, HiringWorkbenchCopy } from "@/modules/types"
import type { AdView, CandidateView, HiringWorkbenchData, JobView } from "@/hooks/hiringWire"
import type { BadgeTone } from "@starci/grammar/common"

/** Real board data and the actual lifetime of one Hiring surface. */
export interface HiringViewInput {
    readonly board: HiringWorkbenchData
    readonly copy: HiringViews["workbenchCopy"]
    readonly isActive: boolean
    readonly isReady: boolean
    readonly scope: string
    readonly focus: string | null
}

/** The chosen tab scopes each Hiring panel controller to its actual lifetime. */
export interface HiringSelectedViewInput extends HiringViewInput {
    readonly selected: HiringViews["tab"]
}

/** The candidates of each job: all of them, the fresh ones and the hired ones. */
const countsOf = (data: HiringWorkbenchData, jobId: string) => {
    const mine = data.candidates.filter((candidate) => candidate.jobId === jobId)
    return {
        all: mine.length,
        fresh: mine.filter((candidate) => candidate.stage === "applied").length,
        hired: mine.filter((candidate) => candidate.stage === "hired").length,
    }
}

/** What one job row needs besides the job: the workbench data, the formatter, the words and the id whose link was just copied. */
export interface JobRowContext {
    readonly data: HiringWorkbenchData
    readonly format: ReturnType<typeof useHiringFormat>
    readonly t: ReturnType<typeof useTranslations<"hiring">>
    readonly copiedId: string | null
}

/** What `jobRowOf` returns. */
export interface JobRowOfResult {
    id: string
    title: string
    statusLabel: string
    statusTone: BadgeTone
    facts: string
    counts: string
    publicUrl: string | null
    copyLabel: string | null
    transitions: { to: string; label: string; isPrimary: boolean }[]
}

/** Resolves the job facts and available status transitions. */
export const jobRowOf = (job: JobView, context: JobRowContext): JobRowOfResult => {
    const { data, format, t, copiedId } = context
    const counts = countsOf(data, job.id)
    const copyKey = copiedId === job.id ? "copiedLink" : "copyLink"
    return {
        id: job.id,
        title: job.title,
        statusLabel: format.label("jobStatus", job.status),
        statusTone: jobStatusTone(job.status),
        facts: [
            format.label("employment", job.employmentType),
            format.pay(job.payMinVnd, job.payMaxVnd, job.payUnit),
            job.location,
            job.schedule,
        ]
            .filter((part) => part !== "")
            .join(" · "),
        counts: t("jobsCounts", { all: counts.all, fresh: counts.fresh, hired: counts.hired, need: job.headcount }),
        publicUrl: job.publicUrl !== null && job.status !== "draft" ? job.publicUrl : null,
        copyLabel: job.publicUrl !== null && job.status === "open" ? t(copyKey) : null,
        transitions: (NEXT_JOB_STATUS[job.status] ?? []).map((to) => ({
            to,
            label: t(`jobAction_${job.status}_${to}`),
            isPrimary: to === "open",
        })),
    }
}

/** What the ad dialog needs: the job it is for, the ad being drafted, the copy words and the translator. */
export interface AdDialogInput {
    readonly job: JobView | undefined
    readonly ad: ReturnType<typeof useHiringJobAd>
    readonly copy: HiringViewInput["copy"]
    readonly t: ReturnType<typeof useTranslations<"hiring">>
}

/** What `jobAdDialogOf` returns. */
export interface JobAdDialogOfResult {
    copy: HiringWorkbenchCopy
    title: string
    ads: AdView | null
    meta: string | null
    publicUrl: string | null
    publicLinkLabel: string | null
    kindLabels: { facebook: string; zalo: string; topcv: string }
    copiedId: string | null
    isBusy: boolean
    error: string | null
}

/** The ad dialog keeps all three actual variants and its record-specific title/link labels together. */
export const jobAdDialogOf = (input: AdDialogInput): JobAdDialogOfResult => {
    const { job, ad, t } = input
    const publicUrl = job?.publicUrl ?? null
    return {
        copy: input.copy,
        title: t("adTitle", { title: job?.title ?? "" }),
        ads: ad.ads,
        meta: ad.meta,
        publicUrl: publicUrl,
        publicLinkLabel: publicUrl === null ? null : t("adLink", { url: publicUrl }),
        kindLabels: { facebook: t("adKind_facebook"), zalo: t("adKind_zalo"), topcv: t("adKind_topcv") },
        copiedId: ad.copiedId,
        isBusy: ad.isPending,
        error: ad.error,
    }
}

/** What `pipelineLaneOf` returns. */
export interface PipelineLaneOfResult {
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
        moveOptions: { id: string; label: string }[]
    }[]
}

/** The resolved heading and cards in one stage. */
export const pipelineLaneOf = (
    lane: PipelineLane,
    t: ReturnType<typeof useTranslations<"hiring">>,
    cardOf: (candidate: CandidateView) => ReturnType<typeof pipelineCardOf>,
): PipelineLaneOfResult => ({
    stage: lane.stage,
    label: t(`stage_${lane.stage}`),
    count: String(lane.candidates.length),
    cards: lane.candidates.map((item) => cardOf(item)),
})

/** Locale and current job context used to resolve one candidate's display facts. */
export interface PipelineCardContext {
    readonly jobId: string
    readonly titles: ReadonlyMap<string, string>
    readonly t: ReturnType<typeof useTranslations<"hiring">>
    readonly format: ReturnType<typeof useHiringFormat>
    readonly nowIso: string
}

/** What `pipelineCardOf` returns. */
export interface PipelineCardOfResult {
    id: string
    name: string
    scoreLabel: string
    scoreTone: BadgeTone
    meta: string
    suggestion: string | null
    moveOptions: { id: string; label: string }[]
}

/** Resolves the original score, source/date metadata, suggestion and allowed move options of one candidate. */
export const pipelineCardOf = (candidate: CandidateView, context: PipelineCardContext): PipelineCardOfResult => {
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
