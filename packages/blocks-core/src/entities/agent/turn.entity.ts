import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"
import { z, type ZodType } from "zod"

import { MAX_BODY, MAX_ID } from "../../bounds"

/** The most tool calls one turn records. */
const MAX_TOOL_CALLS = 50

/** The tool calls of a turn: each tool name and its arguments as JSON text. */
type TurnToolCalls = { readonly calls: ReadonlyArray<{ readonly name: string; readonly argsJson: string }> }

const turnToolCallsShape: ZodType<TurnToolCalls> = z.object({
    calls: z.array(z.object({ name: z.string().max(MAX_ID), argsJson: z.string().max(MAX_BODY) })).max(MAX_TOOL_CALLS),
})

type TurnFields = {
    readonly agentKey: FieldDef<"text", false>
    readonly sessionKey: FieldDef<"text", false>
    readonly turnIndex: FieldDef<"int", false>
    readonly role: FieldDef<"enum", false>
    readonly text: FieldDef<"text", false>
    readonly toolCalls: FieldDef<"jsonb", false> & { readonly shape: ZodType<TurnToolCalls> }
    readonly at: FieldDef<"timestamptz", false>
}

const turnFields: TurnFields = {
    agentKey: field.text({ maxLength: MAX_ID }),
    sessionKey: field.text({ maxLength: MAX_ID }),
    turnIndex: field.int(),
    role: field.enum({ of: ["user", "assistant", "tool", "system"] }),
    text: field.text({ maxLength: MAX_BODY }),
    toolCalls: field.jsonb({ shape: turnToolCallsShape }),
    at: field.timestamptz(),
}

/** One turn of an OpenClaw session, copied in by a declared sync job for history, audit and the read log. */
export const turnEntity: EntityDefinition<TurnFields> = defineEntity({
    name: "agent.turn",
    dataKind: "agent-turn",
    fields: turnFields,
    indexes: [{ name: "recent", on: [{ desc: "at" }, { desc: "id" }] }],
    constraints: [
        { kind: "unique", name: "session_turn_key", on: ["sessionKey", "turnIndex"], refusal: "turn-already-synced" },
    ],
})
