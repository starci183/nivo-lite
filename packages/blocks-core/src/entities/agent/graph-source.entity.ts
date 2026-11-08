import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"

import { MAX_ID } from "../../bounds"

/** The longest kind of source. */
const MAX_KIND = 60

type GraphSourceFields = {
    readonly versionId: FieldDef<"uuid", false>
    readonly agentId: FieldDef<"uuid", false>
    readonly nodeKey: FieldDef<"text", false>
    readonly branchKey: FieldDef<"text", false>
    readonly kind: FieldDef<"text", false>
    readonly ref: FieldDef<"text", false>
    readonly valueHash: FieldDef<"text", false>
}

const graphSourceFields: GraphSourceFields = {
    versionId: field.uuid(),
    agentId: field.uuid(),
    nodeKey: field.text({ maxLength: MAX_ID }),
    branchKey: field.text({ maxLength: MAX_ID, default: "empty" }),
    kind: field.text({ maxLength: MAX_KIND }),
    ref: field.text({ maxLength: MAX_ID }),
    valueHash: field.text({ maxLength: MAX_ID, default: "empty" }),
}

/**
 * One source of one node or branch of a graph version (a Brain fact, a template key, a message), indexed so a changed Brain fact is
 * found without opening every version.
 */
export const agentGraphSourceEntity: EntityDefinition<GraphSourceFields> = defineEntity({
    name: "agent.graph-source",
    dataKind: "agent-graph-source",
    fields: graphSourceFields,
    indexes: [{ name: "kind_version", on: ["kind", "versionId", "id"] }],
    constraints: [
        {
            kind: "unique",
            name: "source_key",
            on: ["versionId", "nodeKey", "branchKey", "kind", "ref"],
            refusal: "source-indexed",
        },
    ],
})
