import type { DecisionQueueView, DecisionRowView } from "../../views/views.types"

/** The command id that opens the answer form of a question. */
export const ANSWER_COMMAND = "edit"

/** The part of a question a decision row shows. */
export interface QuestionLine {
    /** The question id. */
    readonly id: string
    /** The question. */
    readonly text: string
    /** The reference of what it is about; empty when about none. */
    readonly source: string
    /** When it was asked, ISO text. */
    readonly askedAt: string
}

const rowOf = (question: QuestionLine): DecisionRowView => ({
    id: question.id,
    title: question.text,
    description: question.source,
    badges: [],
    reason: null,
    amount: null,
    proposal: question.text,
    trace: null,
    expiry: null,
    primary: null,
    edit: { id: ANSWER_COMMAND, label: ANSWER_COMMAND },
    menu: [],
    draft: { answer: "" },
    waitingFor: null,
    askedAt: question.askedAt,
})

/** The questions that wait for the owner as a decision queue whose edit form is the answer; `total` counts every question that waits. */
export const questionQueueOf = (questions: ReadonlyArray<QuestionLine>, total: number): DecisionQueueView => ({
    count: total === 0 ? null : String(total),
    more: null,
    rows: questions.map((question) => rowOf(question)),
})
