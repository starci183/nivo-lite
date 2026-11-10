import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import type { EntityDefinition, FieldDef } from "@nivo-lite/agent-sdk/entity"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import type { ZodType } from "zod"

import { MAX_ID } from "../../bounds"
import { boundedRecord } from "../../json.schema"

/** A bounded JSON object: the arguments of a call, or the facts it answered. */
type EffectJson = { readonly [key: string]: JsonValue }

type NodeEffectFields = {
    readonly effectKey: FieldDef<"text", false>
    readonly effectId: FieldDef<"text", false>
    readonly subjectEntity: FieldDef<"text", false>
    readonly subjectId: FieldDef<"text", false>
    readonly undoneAt: FieldDef<"timestamptz", true>
    readonly runId: FieldDef<"uuid", true>
    readonly stepKey: FieldDef<"text", true>
    readonly args: FieldDef<"jsonb", true> & { readonly shape: ZodType<EffectJson> }
    readonly facts: FieldDef<"jsonb", true> & { readonly shape: ZodType<EffectJson> }
}

const nodeEffectFields: NodeEffectFields = {
    effectKey: field.text({ maxLength: MAX_ID }),
    effectId: field.text({ maxLength: MAX_ID }),
    subjectEntity: field.text({ maxLength: MAX_ID }),
    subjectId: field.text({ maxLength: MAX_ID }),
    undoneAt: field.timestamptz({ nullable: true }),
    /** The run and the step whose call wrote the record; null for a record written before they were kept. */
    runId: field.uuid({ nullable: true }),
    stepKey: field.text({ maxLength: MAX_ID, nullable: true }),
    /** The arguments the call ran with, so a rerun of the step sees what it already did; null before they were kept. */
    args: field.jsonb({ shape: boundedRecord, nullable: true }),
    /** The facts the call answered (a refusal is never recorded), so a replay answers them as well as the subject. */
    facts: field.jsonb({ shape: boundedRecord, nullable: true }),
}

/**
 * The ledger of the effects graph nodes ran: one record per key in a workspace, the run step's own call key or the node's business
 * dedupe key, with the subject the first run touched, and the run, step, arguments and facts of that call. A repeat of a key answers
 * that subject and acts no more; the lines a stopped step already sent are read from here by run and step.
 */
export const agentNodeEffectEntity: EntityDefinition<NodeEffectFields> = defineEntity({
    name: "agent.node-effect",
    dataKind: "agent-node-effect",
    fields: nodeEffectFields,
    indexes: [{ name: "run_step", on: ["runId", "stepKey", "id"] }],
    constraints: [{ kind: "unique", name: "effect_key_key", on: ["effectKey"], refusal: "effect-already-recorded" }],
})
