import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import type { EntityDefinition, FieldDef } from "@nivo-lite/agent-sdk/entity"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import type { ZodType } from "zod"

import { MAX_BODY, MAX_ID } from "../../bounds"
import { boundedRecord } from "../../json.schema"

/** How a graph version came to be. */
export const GRAPH_CHANGE_KINDS: readonly [string, ...Array<string>] = [
    "seed",
    "chat",
    "edit",
    "conflict",
    "learned",
    "template",
    "rollback",
    "spec",
]

/** The frozen wiring document of a version. */
type VersionDocumentJson = { readonly [key: string]: JsonValue }

type GraphVersionFields = {
    readonly agentId: FieldDef<"uuid", false>
    readonly number: FieldDef<"int", false>
    readonly document: FieldDef<"jsonb", false> & { readonly shape: ZodType<VersionDocumentJson> }
    readonly documentHash: FieldDef<"text", false>
    readonly contextVersionId: FieldDef<"uuid", true>
    readonly changeKind: FieldDef<"enum", false>
    readonly note: FieldDef<"text", false>
    readonly publishedBy: FieldDef<"uuid", true>
    readonly publishedAt: FieldDef<"timestamptz", false>
}

const graphVersionFields: GraphVersionFields = {
    agentId: field.uuid(),
    number: field.int(),
    document: field.jsonb({ shape: boundedRecord }),
    documentHash: field.text({ maxLength: MAX_ID }),
    contextVersionId: field.uuid({ nullable: true }),
    changeKind: field.enum({ of: GRAPH_CHANGE_KINDS }),
    note: field.text({ maxLength: MAX_BODY, default: "empty" }),
    publishedBy: field.uuid({ nullable: true }),
    publishedAt: field.timestamptz({ default: "now" }),
}

/** One frozen version of a graph: written once by a publish and never changed. */
export const agentGraphVersionEntity: EntityDefinition<GraphVersionFields> = defineEntity({
    name: "agent.graph-version",
    dataKind: "agent-graph-version",
    fields: graphVersionFields,
    indexes: [{ name: "agent_version", on: ["agentId", { desc: "number" }, { desc: "id" }] }],
    constraints: [{ kind: "unique", name: "agent_version_key", on: ["agentId", "number"], refusal: "version-taken" }],
    view: true,
})
