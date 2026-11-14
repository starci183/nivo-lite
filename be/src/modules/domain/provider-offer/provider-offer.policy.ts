import {
    accountFactsOf,
    argumentsSchemaOf,
    pinnedReadingOf,
    toolStatesOf,
    type OpenApiToolDeclaration,
    type PinnedDocument,
    type PinnedToolState,
    type ToolsAccountFacts,
} from "@modules/domain/openapi-tools"
import type { ApiVerb, CoreApiVerb } from "@nivo-lite/agent-sdk/names"
import type { ProviderTriggerDeclaration } from "@modules/domain/provider-triggers"
import type { InterfaceProviderRead } from "@modules/domain/workbench-door"
import { isRecord } from "@modules/platform/primitives"
import type {
    OfferFreshness,
    OfferWords,
    OfferedEffect,
    OfferedMember,
    OfferedOperation,
    OfferedRead,
    OfferedTool,
    OfferedTrigger,
} from "./provider-offer.contracts"

/** The member a paged answer lists its rows under. */
const ROWS_MEMBER = "items"

/** The input of every `info` read, as the interface-read contract declares it. */
const INFO_INPUT = { type: "object", required: ["connectionId"], properties: { connectionId: { type: "string", format: "uuid" } } }

/** The answer of every `info` read, as the interface-read contract (`ProviderInfo`) declares it. */
const INFO_OUTPUT = {
    type: "object",
    required: ["connectionId", "state", "figures"],
    properties: {
        connectionId: { type: "string", format: "uuid" },
        state: { type: "string", enum: ["ok", "attention", "off"] },
        figures: { type: "array", items: { type: "object" } },
        asOf: { type: ["string", "null"], format: "date-time" },
    },
}

/** The text of a schema keyword, or null when it holds no text. */
const textOf = (value: unknown): string | null => (typeof value === "string" ? value : null)

/** The JSON type a schema declares: one name, a union joined by `|`, an array with its item type; null when it declares none. */
const typeOf = (schema: Readonly<Record<string, unknown>>): string | null => {
    const { type } = schema
    if (Array.isArray(type)) {
        const names = type.filter((name): name is string => typeof name === "string")
        return names.length === 0 ? null : names.join("|")
    }
    if (type === "array") {
        const item = isRecord(schema.items) ? typeOf(schema.items) : null
        return item === null ? "array" : `array<${item}>`
    }
    return textOf(type)
}

/** The closed values a schema declares (`enum`), as text; empty when it declares none. */
const choicesOf = (schema: Readonly<Record<string, unknown>>): ReadonlyArray<string> =>
    Array.isArray(schema.enum) ? schema.enum.filter((value): value is string => typeof value === "string") : []

/**
 * The members of an object schema: one per property, in the schema's order, with its type, format, closed values and the
 * description the schema itself gives. A schema that is no object with properties has no members.
 */
export const membersOf = (schema: unknown): ReadonlyArray<OfferedMember> => {
    if (!isRecord(schema) || !isRecord(schema.properties)) return []
    const required = Array.isArray(schema.required) ? schema.required : []
    return Object.entries(schema.properties).map(([name, property]): OfferedMember => {
        const member = isRecord(property) ? property : {}
        return {
            name,
            type: typeOf(member),
            format: textOf(member.format),
            required: required.includes(name),
            choices: choicesOf(member),
            label: null,
            description: textOf(member.description),
            filterable: false,
        }
    })
}

/** The account's current-state read of a provider that draws one, under its API verb (`API.sepay.info`). */
export const infoReadOf = (verb: CoreApiVerb): OfferedRead => ({
    name: verb,
    kind: "read",
    shape: "info",
    freshness: "synced",
    summary: null,
    parameters: membersOf(INFO_INPUT),
    returns: membersOf(INFO_OUTPUT),
})

/** A named read a provider registered at the person-read door, under the API verb the door serves it by. */
export const interfaceReadOf = (verb: ApiVerb, read: InterfaceProviderRead, freshness: OfferFreshness): OfferedRead => ({
    name: verb,
    kind: "read",
    shape: read.shape,
    freshness,
    summary: null,
    parameters: membersOf(read.input),
    returns: membersOf(read.output),
})

/** What the account of the OpenAPI provider pinned: its facts, the document read from the stored text, the declared tools. */
export interface SwaggerPin {
    /** What the account says about the tools it serves. */
    readonly facts: ToolsAccountFacts
    /** The pinned document, read from the text stored on the connection. */
    readonly document: PinnedDocument
    /** The tools the installed plugins declare on the account's connector. */
    readonly declarations: ReadonlyArray<OpenApiToolDeclaration>
    /** How each declared tool stands against the document. */
    readonly states: ReadonlyArray<PinnedToolState>
}

/**
 * What an account of the OpenAPI provider pinned, read from the facts and the document text stored on the connection (nothing is
 * fetched); null when it pinned nothing the provider can read. `declarationsOf` gives the tools the plugins declare on a connector.
 */
export const swaggerPinOf = (
    meta: Readonly<Record<string, string>>,
    declarationsOf: (connector: string) => ReadonlyArray<OpenApiToolDeclaration>,
): SwaggerPin | null => {
    const facts = accountFactsOf(meta)
    const document = pinnedReadingOf(meta)
    if (facts === null || document === null) return null
    const declarations = declarationsOf(facts.connector)
    return { facts, document, declarations, states: toolStatesOf(document, declarations) }
}

/** The row schema of a paged answer (`items` of the 200 response), or null when the answer is no page. */
const rowSchemaOf = (output: unknown): unknown => {
    const rows = isRecord(output) && isRecord(output.properties) ? output.properties[ROWS_MEMBER] : null
    return isRecord(rows) && rows.type === "array" && isRecord(rows.items) ? rows.items : null
}

/**
 * The generated reads of the OpenAPI provider, from the PINNED document alone: when the document's source is open to the workspace
 * (`openSources`), one per GET operation the document serves under its base path and supports, named by its API read
 * (`nivo.api.<key>.<method>.<path>`, never a tool id; the door also serves the old spelling `openapi:<verb>` of stored bindings). The parameters are the ones a screen sends (the workspace header and
 * the key are the provider's); the answer is live (the read calls the outside system when a screen runs it).
 */
export const swaggerReadsOf = (pin: SwaggerPin, openSources: ReadonlySet<string>): ReadonlyArray<OfferedRead> =>
    [...pin.document.operations.values()].flatMap((operation): ReadonlyArray<OfferedRead> => {
        if (!openSources.has(pin.document.source.key)) return []
        if (operation.method !== "GET" || operation.unsupported.length > 0) return []
        const output = operation.responses["200"] ?? null
        const rows = rowSchemaOf(output)
        return [
            {
                name: operation.apiVerb,
                kind: "read",
                shape: rows === null ? "record" : "page",
                freshness: "live",
                summary: null,
                parameters: membersOf(argumentsSchemaOf(operation, pin.facts, pin.document.securityHeaders)),
                returns: membersOf(rows ?? output),
            },
        ]
    })

/** What the registries declare of one tool; every member null or absent where nothing is declared. */
export interface ToolSource {
    /** The tool id. */
    readonly id: string
    /** The scope the provider's catalogue gives it (information: the last word on whether it acts). */
    readonly abilityScope: "read" | "write"
    /** The gateway spec's scope, or null when no connector registers the tool. */
    readonly specScope: "read" | "write" | "restricted" | null
    /** The gateway spec's description, or null. */
    readonly description: string | null
    /** The gateway spec's input schema, or null. */
    readonly inputSchema: unknown
    /** The plugin definition's argument schema as JSON Schema, or null. */
    readonly argsSchema: unknown
    /** The plugin definition's result schema as JSON Schema, or null. */
    readonly resultSchema: unknown
    /** Whether the plugin definition says it changes the world, or null when no plugin defines it. */
    readonly mutates: boolean | null
    /** The plugin label's title, else the definition's bilingual title, or null. */
    readonly title: OfferWords | null
    /** The plugin label's summary, or null. */
    readonly summary: OfferWords | null
    /** How it stands against the account's pinned document, for a Swagger tool; else null. */
    readonly pinned: PinnedToolState | null
    /** The effect its provider marks on its gateway spec or in the core marks, or null when none is declared. */
    readonly declaredEffect: OfferedEffect | null
}

/** Whether a tool acts: its gateway spec says so first, then its plugin definition, then the provider catalogue's scope. */
const toolKindOf = (source: ToolSource): "read" | "write" => {
    if (source.specScope !== null) return source.specScope === "read" ? "read" : "write"
    if (source.mutates !== null) return source.mutates ? "write" : "read"
    return source.abilityScope
}

/** The operation of a Swagger tool. */
const operationOf = (state: PinnedToolState): OfferedOperation => ({
    method: state.method,
    path: state.path,
    state: state.state,
    unsupported: state.unsupported,
})

/** One tool of level 2 from what the registries declare of it. */
export const offeredToolOf = (source: ToolSource): OfferedTool => {
    const effect: OfferedEffect | null = source.pinned?.effect ?? source.declaredEffect
    return {
        id: source.id,
        kind: toolKindOf(source),
        effect,
        title: source.title,
        summary: source.summary,
        description: source.description,
        parameters: membersOf(source.inputSchema ?? source.argsSchema),
        returns: membersOf(source.resultSchema),
        operation: source.pinned === null ? null : operationOf(source.pinned),
    }
}

/** One payload field of a trigger, as the catalogue declares it. */
type TriggerField = ProviderTriggerDeclaration["payload"][number]

/** One payload member of a trigger. */
const payloadMemberOf = (field: TriggerField): OfferedMember => ({
    name: field.name,
    type: field.type,
    format: null,
    required: true,
    choices: field.of ?? [],
    label: { vi: field.description.vi, en: field.description.en },
    description: null,
    filterable: field.filterable,
})

/** The triggers of level 3, as the provider declares them. */
export const offeredTriggersOf = (declared: ReadonlyArray<ProviderTriggerDeclaration>): ReadonlyArray<OfferedTrigger> =>
    declared.map((declaration) => ({
        name: declaration.name,
        kind: declaration.kind,
        summary: { vi: declaration.description.vi, en: declaration.description.en },
        payload: declaration.payload.map((field) => payloadMemberOf(field)),
        batching:
            declaration.batching.mode === "list"
                ? { mode: "list", maxEvents: declaration.batching.maxEvents }
                : { mode: "each", maxEvents: null },
        recovery: declaration.recovery,
        decided: declaration.decided,
    }))
