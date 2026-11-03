import type { NodeModelRequest } from "@nivo-lite/agent-sdk/node"
import { ANSWER_INSTRUCTIONS, ANSWER_WORDS, DEFAULT_CLAIMS, NO_ANSWER } from "./answer.messages"
import type { AnswerInput, AnswerOutput, AnswerParams, DocumentRow } from "./answer.types"
import { guardClaims } from "./claims.policy"
import { hasInventedFigure } from "./figures.policy"

/** The only visibility a customer turn reads. */
export const PUBLIC_VISIBILITY = "public"

const BODY_MAX = 4000

/** The documents of a read that are public: the filter is asked of the store and checked again here, so a private row never reaches the model. */
export const publicDocumentsOf = (rows: ReadonlyArray<DocumentRow>): ReadonlyArray<DocumentRow> =>
    rows.filter((row) => row.visibility === PUBLIC_VISIBILITY)

/** The text of the documents the figures of a reply are checked against. */
export const documentsTextOf = (documents: ReadonlyArray<DocumentRow>): string =>
    documents.map((document) => `${document.title}\n${document.body}`).join("\n")

/** The model call: the rules as instructions, the question and the public documents as data. */
export const answerAsk = (question: string, documents: ReadonlyArray<DocumentRow>): NodeModelRequest => ({
    purpose: "knowledge-answer",
    instructions: ANSWER_INSTRUCTIONS,
    input: {
        question,
        documents: documents.map(({ id, title, body }) => ({ id, title, body: body.slice(0, BODY_MAX) })),
    },
})

/** The answer when the public documents do not answer: a neutral line and the question as a gap. */
export const gapAnswerOf = (input: AnswerInput, params: AnswerParams): AnswerOutput => ({
    reply: ANSWER_WORDS[params.locale].gap,
    grounded: false,
    rewritten: false,
    removedClaims: [],
    knowledgeGap: input.question,
})

/**
 * The answer the model's text comes to. No answer, or a figure the documents do not write (a price, a discount percentage), is a gap;
 * a sentence that claims an action the turn did not do is taken out, and what is left is the reply, or a neutral line when nothing is.
 */
export const answerOf = (
    text: string,
    documents: ReadonlyArray<DocumentRow>,
    input: AnswerInput,
    params: AnswerParams,
): AnswerOutput => {
    const reply = text.trim()
    if (reply === "" || reply.includes(NO_ANSWER) || hasInventedFigure(reply, documentsTextOf(documents)))
        return gapAnswerOf(input, params)
    const guarded = guardClaims(reply, params.claims ?? DEFAULT_CLAIMS, input.recordedEffects, params.locale)
    return {
        reply: guarded.kept.length === 0 ? ANSWER_WORDS[params.locale].neutral : guarded.kept.join(" "),
        grounded: true,
        rewritten: guarded.removed.length > 0,
        removedClaims: guarded.removed,
        knowledgeGap: null,
    }
}
