import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"

import { MAX_ID } from "../../bounds"

type NodeEffectFields = {
    readonly effectKey: FieldDef<"text", false>
    readonly effectId: FieldDef<"text", false>
    readonly subjectEntity: FieldDef<"text", false>
    readonly subjectId: FieldDef<"text", false>
    readonly undoneAt: FieldDef<"timestamptz", true>
}

const nodeEffectFields: NodeEffectFields = {
    effectKey: field.text({ maxLength: MAX_ID }),
    effectId: field.text({ maxLength: MAX_ID }),
    subjectEntity: field.text({ maxLength: MAX_ID }),
    subjectId: field.text({ maxLength: MAX_ID }),
    undoneAt: field.timestamptz({ nullable: true }),
}

/**
 * The ledger of the effects graph nodes ran: one record per key in a workspace, the run step's own call key or the node's business
 * dedupe key, with the subject the first run touched. A repeat of a key answers that subject and acts no more.
 */
export const agentNodeEffectEntity: EntityDefinition<NodeEffectFields> = defineEntity({
    name: "agent.node-effect",
    dataKind: "agent-node-effect",
    fields: nodeEffectFields,
    constraints: [{ kind: "unique", name: "effect_key_key", on: ["effectKey"], refusal: "effect-already-recorded" }],
})
