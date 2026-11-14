import { TOOL } from "../names/tool"
import type { JsonValue } from "../schema/schema.types"
import { z } from "../schema/zod-entry"
import { defineEffect } from "./effect"
import type { EffectDefinition } from "./effect.types"

/** The longest id the effect's payload accepts. */
const ID_MAX = 200

/** The longest body of text the effect's payload accepts: the words of a hand-over. */
const BODY_MAX = 20_000

/** The most entries one list or record of the effect's payload holds. */
const ENTRIES_MAX = 1_000

const scalar = z.union([z.string().max(BODY_MAX), z.number(), z.boolean(), z.null()])

/** A JSON value of bounded size: strings, lists and records all have an upper bound. */
const boundedJson: z.ZodType<JsonValue, JsonValue> = z.lazy(() =>
    z.union([scalar, z.array(boundedJson).max(ENTRIES_MAX), boundedRecord]),
)

/** A record of JSON values of bounded size, for plain data a hand-over carries without reading it. */
const boundedRecord: z.ZodType<{ readonly [key: string]: JsonValue }, { readonly [key: string]: JsonValue }> = z
    .record(z.string().max(ID_MAX), boundedJson)
    .refine((entries) => Object.keys(entries).length <= ENTRIES_MAX)

const id = z.string().min(1).max(ID_MAX)
const body = z.string().min(1).max(BODY_MAX)

/** A tag of another agent: by id, or by the module whose agent the workspace runs. */
export interface AgentTagPayload {
    /** The agent to tag. */
    readonly toAgentId?: string | undefined
    /** The module whose agent to tag. */
    readonly toModuleKey?: string | undefined
    /** What the tag says. */
    readonly text: string
    /** The conversation the tag is about. */
    readonly conversationId?: string | undefined
    /** The record the tag is about. */
    readonly subject?: { readonly kind: string; readonly id: string } | undefined
    /** The customer the tag is about, which the target's turn is scoped to. */
    readonly leadId?: string | undefined
    /** The channel the conversation runs on. */
    readonly channel?: string | undefined
    /** Plain data for the target's graph, which reads it as `trigger.context`. */
    readonly context?: Readonly<Record<string, unknown>> | undefined
}

const agentTagPayload: z.ZodType<AgentTagPayload> = z
    .object({
        toAgentId: id.optional(),
        toModuleKey: id.optional(),
        text: body,
        conversationId: id.optional(),
        subject: z.object({ kind: id, id }).optional(),
        leadId: id.optional(),
        channel: id.optional(),
        context: boundedRecord.optional(),
    })
    .refine((payload) => (payload.toAgentId === undefined) !== (payload.toModuleKey === undefined))

/**
 * Tags another agent, which its tag grants allow; the subject is the tag. The hand-over of one agent to another is how NIVO runs agents,
 * so the effect is the engine's: a package lists it in its `effects` (the core package does) and its title words come from the package.
 */
export const agentTagEffect: EffectDefinition<z.ZodType<AgentTagPayload>> = defineEffect({
    id: TOOL.agentTag,
    title: { key: "effectAgentTag" },
    payload: agentTagPayload,
})
