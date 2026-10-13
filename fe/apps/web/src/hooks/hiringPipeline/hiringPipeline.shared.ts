import { PIPELINE_STAGES } from "@/hooks/hiring"
import type { CandidateView } from "@/hooks/hiringWire"

/** The filter value that shows the candidates of every job. */
export const ALL_JOBS = "all"

/** The candidates of one stage: best score first, then newest. */
export interface PipelineLane {
    readonly stage: string
    readonly candidates: ReadonlyArray<CandidateView>
}

const inJob = (candidate: CandidateView, jobId: string): boolean => jobId === ALL_JOBS || candidate.jobId === jobId

/** The board lanes of one job (or all): withdrawn candidates leave the board, each lane is ordered by score then recency. */
export const pipelineLanes = (candidates: ReadonlyArray<CandidateView>, jobId: string): Array<PipelineLane> =>
    PIPELINE_STAGES.map((stage) => ({
        stage,
        candidates: candidates
            .filter((candidate) => inJob(candidate, jobId) && candidate.stage === stage)
            .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.createdAt.localeCompare(a.createdAt)),
    }))

/** How many candidates of one job (or all) withdrew their application. */
export const withdrawnCount = (candidates: ReadonlyArray<CandidateView>, jobId: string): number =>
    candidates.filter((candidate) => inJob(candidate, jobId) && candidate.stage === "withdrawn").length

/** A reason shorter than this is not a reason. */
export const REASON_MIN = 3
