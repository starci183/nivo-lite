import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import type { EntityDefinition, FieldDef } from "@nivo-lite/agent-sdk/entity"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import type { ZodType } from "zod"

import { MAX_ID } from "../../bounds"
import { boundedRecord } from "../../json.schema"

/** The most door calls one step records. */
const MAX_DOOR_CALLS = 50

/** The longest handler kind. */
const MAX_KIND = 60

/** What a step does to the world: nothing, something a named handler undoes, or something nothing undoes. */
type StepEffectShape =
    | { readonly kind: "read" }
    | { readonly kind: "compensable"; readonly compensation: string }
    | { readonly kind: "pivot" }

const stepEffectShape: ZodType<StepEffectShape> = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("read") }),
    z.object({ kind: z.literal("compensable"), compensation: z.string().max(MAX_ID) }),
    z.object({ kind: z.literal("pivot") }),
])

/** The door calls a step made, in order, each with the effect key it was sent under. */
type StepDoorCalls = {
    readonly calls: ReadonlyArray<{
        readonly tool: string
        readonly ok: boolean
        readonly failure?: string | undefined
        readonly effectKey: string
    }>
}

const stepDoorCallsShape: ZodType<StepDoorCalls> = z.object({
    calls: z
        .array(
            z.object({
                tool: z.string().max(MAX_ID),
                ok: z.boolean(),
                failure: z.string().max(MAX_ID).optional(),
                effectKey: z.string().max(MAX_ID),
            }),
        )
        .max(MAX_DOOR_CALLS),
})

/** A bounded JSON object: the input a step runs from, its result or its error. */
type StepJson = { readonly [key: string]: JsonValue }

/** Where a step stands. */
export const RUN_STEP_STATUSES: readonly [string, ...Array<string>] = [
    "pending",
    "running",
    "done",
    "failed",
    "compensating",
    "compensated",
]

type RunStepFields = {
    readonly runId: FieldDef<"uuid", false>
    readonly ordinal: FieldDef<"int", false>
    readonly stepKey: FieldDef<"text", false>
    readonly nodeKey: FieldDef<"text", false>
    readonly kind: FieldDef<"text", false>
    readonly effect: FieldDef<"jsonb", false> & { readonly shape: ZodType<StepEffectShape> }
    readonly input: FieldDef<"jsonb", false> & { readonly shape: ZodType<StepJson> }
    readonly result: FieldDef<"jsonb", true> & { readonly shape: ZodType<StepJson> }
    readonly status: FieldDef<"enum", false>
    readonly attempt: FieldDef<"int", false>
    readonly maxAttempts: FieldDef<"int", false>
    readonly deadlineMs: FieldDef<"int", true>
    readonly notBefore: FieldDef<"timestamptz", true>
    readonly waitItemId: FieldDef<"uuid", true>
    readonly workItemId: FieldDef<"uuid", true>
    readonly compAttempts: FieldDef<"int", false>
    readonly errorCode: FieldDef<"text", true>
    readonly claimedUntil: FieldDef<"timestamptz", true>
    readonly startedAt: FieldDef<"timestamptz", true>
    readonly endedAt: FieldDef<"timestamptz", true>
    readonly durationMs: FieldDef<"int", true>
    readonly doorCalls: FieldDef<"jsonb", false> & { readonly shape: ZodType<StepDoorCalls> }
    readonly effectKey: FieldDef<"text", true>
    readonly error: FieldDef<"jsonb", true> & { readonly shape: ZodType<StepJson> }
}

const runStepFields: RunStepFields = {
    runId: field.uuid(),
    ordinal: field.int(),
    stepKey: field.text({ maxLength: MAX_ID }),
    nodeKey: field.text({ maxLength: MAX_ID }),
    kind: field.text({ maxLength: MAX_KIND }),
    effect: field.jsonb({ shape: stepEffectShape }),
    input: field.jsonb({ shape: boundedRecord }),
    result: field.jsonb({ shape: boundedRecord, nullable: true }),
    status: field.enum({ of: RUN_STEP_STATUSES, default: { literal: "pending" } }),
    attempt: field.int({ default: { literal: 0 } }),
    maxAttempts: field.int({ default: { literal: 3 } }),
    deadlineMs: field.int({ nullable: true }),
    notBefore: field.timestamptz({ nullable: true }),
    waitItemId: field.uuid({ nullable: true }),
    workItemId: field.uuid({ nullable: true }),
    compAttempts: field.int({ default: { literal: 0 } }),
    errorCode: field.text({ maxLength: 120, nullable: true }),
    claimedUntil: field.timestamptz({ nullable: true }),
    startedAt: field.timestamptz({ nullable: true }),
    endedAt: field.timestamptz({ nullable: true }),
    durationMs: field.int({ nullable: true }),
    doorCalls: field.jsonb({ shape: stepDoorCallsShape }),
    effectKey: field.text({ maxLength: MAX_ID, nullable: true }),
    error: field.jsonb({ shape: boundedRecord, nullable: true }),
}

/**
 * One step of a run: its place, its effect, its claim and the result it stored. A claim, a commit and a release are engine updates
 * under the record version the claim returned, so a replaced worker's write is stale.
 */
export const agentRunStepEntity: EntityDefinition<RunStepFields> = defineEntity({
    name: "agent.run-step",
    dataKind: "agent-run-step",
    fields: runStepFields,
    relations: { run: { kind: "toOne", target: "agent.run", required: true, onDelete: "cascade" } },
    indexes: [
        { name: "run_ordinal", on: ["runId", "ordinal", "id"] },
        { name: "status_claimed", on: ["status", "claimedUntil", "id"] },
        { name: "status_not_before", on: ["status", "notBefore", "id"] },
        { name: "wait_item", on: ["waitItemId", "id"] },
        { name: "kind_work_item", on: ["kind", "workItemId", "id"] },
    ],
    constraints: [{ kind: "unique", name: "run_step_key", on: ["runId", "stepKey"], refusal: "step-already-written" }],
    view: true,
})
