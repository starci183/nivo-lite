import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import type { EntityDefinition, FieldDef } from "@nivo-lite/agent-sdk/entity"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import type { ZodType } from "zod"

import { MAX_BODY, MAX_ID } from "../../bounds"
import { boundedRecord } from "../../json.schema"

/** Where a run stands: `waiting` holds a durable wait, `parked` waits for a build or a person to resume it, `dead` was given to a person, `cancelled` was stopped by an owner or manager. */
export const RUN_STATUSES: readonly [string, ...Array<string>] = [
    "running",
    "waiting",
    "parked",
    "failed",
    "done",
    "dead",
    "compensating",
    "compensated",
    "cancelled",
]

/** A bounded JSON object: the trigger a run keeps, or the error it stopped with. */
type RunJson = { readonly [key: string]: JsonValue }

type RunFields = {
    readonly agentId: FieldDef<"uuid", false>
    readonly wakeId: FieldDef<"uuid", false>
    readonly trigger: FieldDef<"text", false>
    readonly graphVersionId: FieldDef<"uuid", true>
    readonly planning: FieldDef<"bool", false>
    readonly status: FieldDef<"enum", false>
    readonly context: FieldDef<"jsonb", false> & { readonly shape: ZodType<RunJson> }
    readonly error: FieldDef<"jsonb", true> & { readonly shape: ZodType<RunJson> }
    readonly deadLetteredAt: FieldDef<"timestamptz", true>
    readonly parkedBuild: FieldDef<"text", true>
    readonly parkReason: FieldDef<"text", true>
    readonly resumeAttempts: FieldDef<"int", false>
    readonly resumeNotBefore: FieldDef<"timestamptz", true>
    readonly resumedAt: FieldDef<"timestamptz", true>
    readonly resumedBy: FieldDef<"text", true>
    readonly resumeReason: FieldDef<"text", true>
    readonly waitWorkItemId: FieldDef<"uuid", true>
    readonly waitDeadlineAt: FieldDef<"timestamptz", true>
    readonly stepSeq: FieldDef<"int", false>
    readonly startedAt: FieldDef<"timestamptz", false>
    readonly endedAt: FieldDef<"timestamptz", true>
    readonly cancelledAt: FieldDef<"timestamptz", true>
    readonly cancelledBy: FieldDef<"text", true>
}

const runFields: RunFields = {
    agentId: field.uuid(),
    wakeId: field.uuid(),
    trigger: field.text({ maxLength: 120 }),
    graphVersionId: field.uuid({ nullable: true }),
    planning: field.bool({ default: { literal: false } }),
    status: field.enum({ of: RUN_STATUSES, default: { literal: "running" } }),
    context: field.jsonb({ shape: boundedRecord }),
    error: field.jsonb({ shape: boundedRecord, nullable: true }),
    deadLetteredAt: field.timestamptz({ nullable: true }),
    parkedBuild: field.text({ maxLength: MAX_ID, nullable: true }),
    parkReason: field.text({ maxLength: MAX_BODY, nullable: true }),
    resumeAttempts: field.int({ default: { literal: 0 } }),
    resumeNotBefore: field.timestamptz({ nullable: true }),
    resumedAt: field.timestamptz({ nullable: true }),
    resumedBy: field.text({ maxLength: MAX_ID, nullable: true }),
    resumeReason: field.text({ maxLength: MAX_BODY, nullable: true }),
    waitWorkItemId: field.uuid({ nullable: true }),
    waitDeadlineAt: field.timestamptz({ nullable: true }),
    stepSeq: field.int({ default: { literal: 0 } }),
    startedAt: field.timestamptz({ default: "now" }),
    endedAt: field.timestamptz({ nullable: true }),
    cancelledAt: field.timestamptz({ nullable: true }),
    cancelledBy: field.text({ maxLength: MAX_ID, nullable: true }),
}

/**
 * The durable run of one wake: its status, the trigger intact for a person, the park and resume bookkeeping and the work item it
 * waits on. Written by the agent-runs capability only; the record version is the fence of every write.
 */
export const agentRunEntity: EntityDefinition<RunFields> = defineEntity({
    name: "agent.run",
    dataKind: "agent-run",
    fields: runFields,
    indexes: [
        { name: "wake", on: ["wakeId", "id"] },
        { name: "agent_started", on: ["agentId", { desc: "startedAt" }, { desc: "id" }] },
        { name: "agent_status_ended", on: ["agentId", "status", { desc: "endedAt" }, { desc: "id" }] },
        { name: "status_resume", on: ["status", "resumeNotBefore", "id"] },
        { name: "status_dead_lettered", on: ["status", "deadLetteredAt", "id"] },
    ],
    constraints: [
        { kind: "unique", name: "wake_planning_key", on: ["wakeId", "planning"], refusal: "run-already-open" },
    ],
    view: true,
})
