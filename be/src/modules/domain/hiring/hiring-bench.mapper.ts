import type { JobQuestion, QuestionType } from "./hiring.contracts"
import type { HiringBenchView, HiringJobView } from "./hiring-workbench.contracts"

/** One screening question with its expectation written as three typed fields, one per kind of answer. */
interface HiringJobQuestionFields {
    /** The question id. */
    readonly id: string
    /** The question text. */
    readonly text: string
    /** The kind of answer. */
    readonly type: QuestionType
    /** Whether an answer is required. */
    readonly required: boolean
    /** The choices offered; empty when the question has none. */
    readonly choices: ReadonlyArray<string>
    /** The expected yes or no, when the expectation is one. */
    readonly expectYesNo: "yes" | "no" | null
    /** The expected number, when the expectation is one. */
    readonly expectNumber: number | null
    /** The expected choices, when the expectation is a list. */
    readonly expectChoices: ReadonlyArray<string> | null
}

/** One job post whose questions carry typed expectation fields. */
interface HiringJobFields extends Omit<HiringJobView, "questions"> {
    /** The screening questions of the post. */
    readonly questions: ReadonlyArray<HiringJobQuestionFields>
}

/** The workbench whose job questions carry typed expectation fields. */
interface HiringBenchFields extends Omit<HiringBenchView, "jobs"> {
    /** The job posts of the workspace. */
    readonly jobs: ReadonlyArray<HiringJobFields>
}

/** Splits the expectation of one question into its yes/no, number and choices fields. */
const toHiringJobQuestionFields = (question: JobQuestion): HiringJobQuestionFields => ({
    id: question.id,
    text: question.text,
    type: question.type,
    required: question.required,
    choices: question.choices === undefined ? [] : [...question.choices],
    expectYesNo: question.expect === "yes" || question.expect === "no" ? question.expect : null,
    expectNumber: typeof question.expect === "number" ? question.expect : null,
    expectChoices: Array.isArray(question.expect) ? [...question.expect] : null,
})

/** Maps one job post with its questions split into typed fields. */
const toHiringJobFields = (job: HiringJobView): HiringJobFields => ({
    ...job,
    questions: job.questions.map(toHiringJobQuestionFields),
})

/** Maps the workbench view so question expectations become three typed fields. */
export const toHiringBenchType = (result: HiringBenchView): HiringBenchFields => ({
    ...result,
    jobs: result.jobs.map(toHiringJobFields),
})
