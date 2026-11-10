import { z } from "zod"
import type { EffectDefinition, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { isDomainError } from "@modules/platform/errors"
import { isRecord } from "@modules/platform/primitives"
import { gatewayArgumentsSchema } from "../gateway-tools.schema"
import type { GatewayArgumentSchema } from "../gateway-tools.schema"
import type { GatewayArgument, GatewayJson, NativeConnectorManifest, NativeToolSpec } from "../mcp-gateway.contracts"

/** The kind of the fact a tool answers when it refuses (the SDK's `EFFECT_REFUSED`). */
export const REFUSED = "refused"

/** The per-call limit of an effect connector: the longest the gateway allows, since a send waits on its channel. */
export const EFFECT_TOOL_TIMEOUT_MS = 15_000

/** The contract version every effect connector announces. */
const CONTRACT_VERSION = "nivo-effects@1"

/** The schema advertised when an effect's payload cannot be written as JSON Schema. */
const OPEN_OBJECT: GatewayJson = { type: "object" }

/** An effect id split at its first dot: the connector key (its domain) and the tool name inside it (`order.create` → `order`, `create`). */
export interface EffectAddress {
    /** The connector key. */
    readonly connector: string
    /** The tool name inside the connector. */
    readonly tool: string
}

/** The address of an effect id, or null when it has no dot. */
export const effectAddressOf = (id: string): EffectAddress | null => {
    const dot = id.indexOf(".")
    return dot <= 0 || dot === id.length - 1 ? null : { connector: id.slice(0, dot), tool: id.slice(dot + 1) }
}

/** A value as JSON the gateway can carry: undefined members dropped, a date as ISO text, anything else not JSON as null. */
export const jsonOf = (value: unknown): GatewayArgument => {
    if (value === null || typeof value === "string" || typeof value === "boolean") return value
    if (typeof value === "number") return Number.isFinite(value) ? value : null
    if (value instanceof Date) return value.toISOString()
    if (Array.isArray(value)) return value.map((entry: unknown) => jsonOf(entry))
    if (typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value)
                .filter(([, entry]) => entry !== undefined)
                .map(([member, entry]) => [member, jsonOf(entry)]),
        )
    }
    return null
}

/** The fact a tool answered, as the gateway carries it. */
export const answerOf = (subject: SubjectRef): GatewayJson => ({
    kind: subject.kind,
    id: subject.id,
    ...(subject.facts === undefined ? {} : { facts: jsonOf(subject.facts) }),
})

/** A refusal fact: the reason and the true values beside it. */
export const refusalOf = (reason: string, facts: Readonly<Record<string, unknown>> = {}): SubjectRef => ({
    kind: REFUSED,
    id: reason,
    ...(Object.keys(facts).length === 0 ? {} : { facts }),
})

/**
 * What an executor's throw is to the agent: a typed domain error (a guard such as a conversation held by a person) is a refusal fact
 * carrying its code and params, the same the agent read when it called the effect through `context.effect`; null for anything else, which
 * stays a failure of the call.
 */
export const refusalOfThrow = (cause: unknown): SubjectRef | null =>
    isDomainError(cause) ? refusalOf(cause.code, cause.params) : null

const inputSchemaOf = (payload: z.ZodType): GatewayJson => {
    try {
        const schema = jsonOf(z.toJSONSchema(payload, { io: "input" }))
        return isRecord(schema) ? schema : OPEN_OBJECT
    } catch {
        return OPEN_OBJECT
    }
}

/** The bounded gateway arguments that the effect's own payload schema also accepts. */
const argumentSchemaOf = (payload: z.ZodType): GatewayArgumentSchema =>
    gatewayArgumentsSchema.refine((args) => payload.safeParse(args).success)

/** The gateway tool of one effect: a write, granted by a step's allow-list, kept by the effect ledger, never held by the taint rule. */
const toolOf = (effect: EffectDefinition, tool: string): NativeToolSpec => ({
    name: tool,
    description: `NIVO business action ${effect.id}: takes ids and words only, answers a fact (or a refusal with its reason).`,
    scope: "write",
    defaultMode: "ask",
    inputSchema: inputSchemaOf(effect.payload),
    argumentSchema: argumentSchemaOf(effect.payload),
    ledgered: true,
    stepGranted: true,
    taintExempt: true,
})

/**
 * One native manifest per domain of the installed effects, in the order the domains first appear: the connector key is the effect id up
 * to its first dot and the tool its rest, so the gateway's full name of a tool is the effect id itself (`customer.message.send`).
 */
export const effectManifestsOf = (effects: Iterable<EffectDefinition>): ReadonlyArray<NativeConnectorManifest> => {
    const byKey = new Map<string, Array<NativeToolSpec>>()
    for (const effect of effects) {
        const address = effectAddressOf(effect.id)
        if (address === null) continue
        byKey.set(address.connector, [...(byKey.get(address.connector) ?? []), toolOf(effect, address.tool)])
    }
    return [...byKey.entries()].map(([key, tools]) => ({
        key,
        name: `NIVO ${key}`,
        kind: "native",
        contractVersion: CONTRACT_VERSION,
        timeoutMs: EFFECT_TOOL_TIMEOUT_MS,
        tools,
    }))
}
