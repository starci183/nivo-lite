import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import type { EntityDefinition, FieldDef } from "@nivo-lite/agent-sdk/entity"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import type { ZodType } from "zod"

import { boundedRecord } from "../../json.schema"

/** Whether a graph decides (`enforced`) or only records (`shadow`). */
export const GRAPH_MODES: readonly [string, ...Array<string>] = ["shadow", "enforced"]

/** The plain wiring document of a graph: nodes, edges, triggers and waits, as bounded JSON. */
type GraphDocumentJson = { readonly [key: string]: JsonValue }

type GraphFields = {
    readonly agentId: FieldDef<"uuid", false>
    readonly installationId: FieldDef<"uuid", false>
    readonly draft: FieldDef<"jsonb", false> & { readonly shape: ZodType<GraphDocumentJson> }
    readonly draftRev: FieldDef<"int", false>
    readonly activeVersionId: FieldDef<"uuid", true>
    readonly mode: FieldDef<"enum", false>
    readonly modeSetBy: FieldDef<"uuid", true>
    readonly modeSetAt: FieldDef<"timestamptz", true>
}

const graphFields: GraphFields = {
    agentId: field.uuid(),
    installationId: field.uuid(),
    draft: field.jsonb({ shape: boundedRecord }),
    draftRev: field.int({ default: { literal: 1 } }),
    activeVersionId: field.uuid({ nullable: true }),
    mode: field.enum({ of: GRAPH_MODES, default: { literal: "enforced" } }),
    modeSetBy: field.uuid({ nullable: true }),
    modeSetAt: field.timestamptz({ nullable: true }),
}

/**
 * The graph of one agent: the draft the editor changes under a revision check, the version that decides and whether it decides or only
 * records. The draft only wires the agent's own nodes. The record version is the fence of every write.
 */
export const agentGraphEntity: EntityDefinition<GraphFields> = defineEntity({
    name: "agent.graph",
    dataKind: "agent-graph",
    fields: graphFields,
    indexes: [{ name: "installation", on: ["installationId", "id"] }],
    constraints: [{ kind: "unique", name: "agent_key", on: ["agentId"], refusal: "graph-exists" }],
    matchKeys: [{ name: "agent", on: ["agentId"] }],
    view: true,
})
