import type { JobQuestion } from "@modules/domain/hiring"
import type { HiringBenchView, HiringCandidateDetailView, HiringJobView } from "@modules/domain/hiring"
import type { HiringCandidateDetailRequest } from "../../application/hiring-candidate-detail.contracts"
import type { HiringWorkbenchRequest } from "../../application/hiring-workbench.contracts"
import type { HiringBenchType } from "./dto/hiring-bench.type"
import type { HiringCandidateDetailType } from "./dto/hiring-candidate-detail.type"
import type { HiringCandidateRefInput } from "./dto/hiring-candidate-ref.input"
import type { HiringJobQuestionType } from "./dto/hiring-job-question-view.type"
import type { HiringJobType } from "./dto/hiring-job.type"

/** Maps the workspace scope to the workbench request. */
export const toHiringWorkbenchRequest = (workspaceId: string): HiringWorkbenchRequest => ({ workspaceId })

/** Maps the GraphQL input to the candidate detail request of the workspace it names. */
export const toHiringCandidateDetailRequest = (
    workspaceId: string,
    input: HiringCandidateRefInput,
): HiringCandidateDetailRequest => ({ workspaceId, candidateId: input.id })

const toHiringJobQuestionType = (question: JobQuestion): HiringJobQuestionType => ({
    id: question.id,
    text: question.text,
    type: question.type,
    required: question.required,
    choices: question.choices === undefined ? [] : [...question.choices],
    expectYesNo: question.expect === "yes" || question.expect === "no" ? question.expect : null,
    expectNumber: typeof question.expect === "number" ? question.expect : null,
    expectChoices: Array.isArray(question.expect) ? [...question.expect] : null,
})

const toHiringJobType = (job: HiringJobView): HiringJobType => ({
    ...job,
    questions: job.questions.map(toHiringJobQuestionType),
})

/** Maps the workbench view to the GraphQL type; question expectations become three typed fields. */
export const toHiringBenchType = (result: HiringBenchView): HiringBenchType => ({
    ...result,
    jobs: result.jobs.map(toHiringJobType),
})

/** Maps the candidate detail view to the GraphQL type. */
export const toHiringCandidateDetailType = (result: HiringCandidateDetailView): HiringCandidateDetailType => result
