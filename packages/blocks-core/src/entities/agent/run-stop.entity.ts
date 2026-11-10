import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import type { EntityDefinition, FieldDef } from "@nivo-lite/agent-sdk/entity"
import { z } from "zod"
import type { ZodType } from "zod"

import { MAX_BODY, MAX_ID, MAX_LINE } from "../../bounds"

/** Why a step stopped: the AI core reported it, the AI itself failed (the engine's words stand in), or a tool call waits for approval. */
export const RUN_STOP_KINDS: readonly [string, ...Array<string>] = ["ai_report", "ai_error", "approval", "engine"]

/** Where a stop stands: `open` while it waits for the founder (or a deadline), `resolved` once a decision moved the run on. */
export const RUN_STOP_STATES: readonly [string, ...Array<string>] = ["open", "resolved"]

/** How a stop was answered: the founder's words, one of the three buttons, or a NIVO deadline. */
export const RUN_STOP_DECISIONS = ["answer", "retry", "take_over", "skip", "timeout"] as const

/** The most suggestions, facts, lines and answers one stop keeps. */
const MAX_STOP_ENTRIES = 50

/** The longest moment text the engine writes. */
const MAX_TIME = 40

/** One suggested way on, from the AI core, and who would do it. */
export type RunStopSuggestion = {
    readonly text: string
    readonly handledBy: "workflow" | "person"
}

/** One true fact the engine attached to the stop, by name. */
export type RunStopFact = {
    readonly name: string
    readonly value: string
}

/** What the AI core (or the engine) said about the stop besides the reason and the question. */
export type RunStopDetail = {
    readonly suggestions: ReadonlyArray<RunStopSuggestion>
    readonly facts: ReadonlyArray<RunStopFact>
}

/** One line the stopped step sent a customer while the stop was open: where, the words, when. */
export type RunStopCustomerLine = {
    readonly conversationId: string
    readonly text: string
    readonly at: string
}

/** The customer lines of a stop, in the order they went out. */
export type RunStopCustomerLines = {
    readonly lines: ReadonlyArray<RunStopCustomerLine>
}

/** One answer the stop received: the founder's words or a button, who gave it and when. */
export type RunStopAnswer = {
    readonly kind: (typeof RUN_STOP_DECISIONS)[number]
    readonly text: string | null
    readonly by: string
    readonly at: string
}

/** The answers of a stop, oldest first: the trace the card shows. */
export type RunStopAnswers = {
    readonly answers: ReadonlyArray<RunStopAnswer>
}

/** The decision that resolved the stop. */
export type RunStopDecision = RunStopAnswer

const suggestionShape = z.object({ text: z.string().min(1).max(MAX_LINE), handledBy: z.enum(["workflow", "person"]) })
const factShape = z.object({ name: z.string().max(MAX_ID), value: z.string().max(MAX_LINE) })
const answerShape = z.object({
    kind: z.enum(RUN_STOP_DECISIONS),
    text: z.string().max(MAX_BODY).nullable(),
    by: z.string().max(MAX_ID),
    at: z.string().max(MAX_TIME),
})

/** The shape of `detail`. */
export const RUN_STOP_DETAIL_SHAPE: ZodType<RunStopDetail> = z.object({
    suggestions: z.array(suggestionShape).max(MAX_STOP_ENTRIES),
    facts: z.array(factShape).max(MAX_STOP_ENTRIES),
})

/** The shape of `customerLines`. */
export const RUN_STOP_LINES_SHAPE: ZodType<RunStopCustomerLines> = z.object({
    lines: z
        .array(z.object({ conversationId: z.string().max(MAX_ID), text: z.string().max(MAX_BODY), at: z.string().max(MAX_TIME) }))
        .max(MAX_STOP_ENTRIES),
})

/** The shape of `answers`. */
export const RUN_STOP_ANSWERS_SHAPE: ZodType<RunStopAnswers> = z.object({
    answers: z.array(answerShape).max(MAX_STOP_ENTRIES),
})

/** The shape of `decision`. */
export const RUN_STOP_DECISION_SHAPE: ZodType<RunStopDecision> = answerShape

type RunStopFields = {
    readonly runId: FieldDef<"uuid", false>
    readonly stepKey: FieldDef<"text", false>
    readonly agentId: FieldDef<"uuid", false>
    readonly workflowId: FieldDef<"uuid", true>
    readonly leadId: FieldDef<"uuid", true>
    readonly conversationId: FieldDef<"uuid", true>
    readonly kind: FieldDef<"enum", false>
    readonly state: FieldDef<"enum", false>
    readonly reason: FieldDef<"text", false>
    readonly question: FieldDef<"text", true>
    readonly detail: FieldDef<"jsonb", false> & { readonly shape: ZodType<RunStopDetail> }
    readonly cardMessageId: FieldDef<"uuid", true>
    readonly customerLines: FieldDef<"jsonb", false> & { readonly shape: ZodType<RunStopCustomerLines> }
    readonly answers: FieldDef<"jsonb", false> & { readonly shape: ZodType<RunStopAnswers> }
    readonly decision: FieldDef<"jsonb", true> & { readonly shape: ZodType<RunStopDecision> }
    readonly repeats: FieldDef<"int", false>
    readonly stoppedAt: FieldDef<"timestamptz", false>
    readonly resolvedAt: FieldDef<"timestamptz", true>
}

const runStopFields: RunStopFields = {
    runId: field.uuid(),
    stepKey: field.text({ maxLength: MAX_ID }),
    agentId: field.uuid(),
    workflowId: field.uuid({ nullable: true }),
    leadId: field.uuid({ nullable: true }),
    conversationId: field.uuid({ nullable: true }),
    kind: field.enum({ of: RUN_STOP_KINDS }),
    state: field.enum({ of: RUN_STOP_STATES, default: { literal: "open" } }),
    reason: field.text({ maxLength: MAX_BODY }),
    question: field.text({ maxLength: MAX_BODY, nullable: true }),
    detail: field.jsonb({ shape: RUN_STOP_DETAIL_SHAPE }),
    cardMessageId: field.uuid({ nullable: true }),
    customerLines: field.jsonb({ shape: RUN_STOP_LINES_SHAPE }),
    answers: field.jsonb({ shape: RUN_STOP_ANSWERS_SHAPE }),
    decision: field.jsonb({ shape: RUN_STOP_DECISION_SHAPE, nullable: true }),
    repeats: field.int({ default: { literal: 1 } }),
    stoppedAt: field.timestamptz({ default: "now" }),
    resolvedAt: field.timestamptz({ nullable: true }),
}

/**
 * The stop of one step of one run (`agent.run-stop`): the one mechanism for every run that cannot go on by itself, with a customer or
 * without (a bank-fed run has neither). One record per run and step, never per customer: what the AI core (or the engine) said, the card
 * it posted to the team (rewritten in place, never a second card), the lines the stopped step sent customers (so no second line goes out
 * for the same stop), the founder's answers in order and the decision that resolved it. A step that stops again after an answer reopens
 * the same record (`repeats`). Written by the graph engine only; the record version is the fence of every write.
 */
export const agentRunStopEntity: EntityDefinition<RunStopFields> = defineEntity({
    name: "agent.run-stop",
    dataKind: "agent-run-stop",
    fields: runStopFields,
    indexes: [
        { name: "run", on: ["runId", "id"] },
        { name: "lead_state", on: ["leadId", "state", "id"] },
        { name: "state_stopped", on: ["state", { desc: "stoppedAt" }, { desc: "id" }] },
    ],
    constraints: [{ kind: "unique", name: "run_step_key", on: ["runId", "stepKey"], refusal: "run-stop-taken" }],
    matchKeys: [{ name: "run_step", on: ["runId", "stepKey"] }],
    view: true,
})
