import { createHash } from "node:crypto"
import { crmBasePathOf, crmIdOfProviderKey, crmOpNameOf } from "@nivo-lite/agent-sdk/names"
import { isCrmOp } from "@nivo-lite/agent-sdk/schema"
import { isRecord, parseJsonText } from "@modules/platform/primitives"
import { declaredPropertiesOf, resolvedSchemaOf, typesOf } from "./openapi-schema.policy"
import {
  PINNED_EFFECTS,
  type DocumentProblem,
  type DocumentReading,
  type JsonMembers,
  type OpenApiSource,
  type PinnedBody,
  type PinnedEffect,
  type PinnedMethod,
  type PinnedOperation,
  type PinnedDocument,
  type PinnedParameter,
  type SchemaNode,
  type ToolIdProblem,
  type ToolIdProblemCode,
} from "./openapi-tools.contracts"

/** The largest document the provider pins, in characters. */
export const DOCUMENT_MAX_CHARS = 1_000_000

/** The media type the provider reads and writes. */
const JSON_MEDIA = "application/json"

/** The methods read from a path item, by the member that holds each. */
const METHODS: ReadonlyArray<readonly [string, PinnedMethod]> = [
    ["get", "GET"],
    ["post", "POST"],
    ["put", "PUT"],
    ["patch", "PATCH"],
    ["delete", "DELETE"],
]

/** The operation member that opens an operation to a run that serves a customer; absent, the operation is internal only. */
const CUSTOMER_AUDIENCE = "x-nivo-customer-audience"

/** The operation member that names the parameter holding the customer's identity. */
const CUSTOMER_PARAMETER = "x-nivo-customer-parameter"

/** The operation member that marks what the operation does to the world: `money`, `irreversible` or `none`. */
const EFFECT = "x-nivo-effect"

/** The prefix of every CRM operation (`nivo.api.crm.<crmId>....`): one name a node calls and an interface reads alike. */
const API_PREFIX = "nivo.api."

/** The source a document declares, or why it declares none the provider can serve. */
export type SourceReading =
    { readonly ok: true; readonly source: OpenApiSource } | { readonly ok: false; readonly problem: DocumentProblem }

/**
 * The source of a document read for the CRM whose provider key is `providerKey` (`crm.nivoweb`): that key, and the base path its
 * operations live under, dropped from their names: the path of its first server (`servers[0].url`), else the base path an older NIVO Web
 * document states (`info["x-nivo-source"].basePath`), else the root. Structural only. A key that is no CRM's is `crm_id_invalid`.
 */
export const sourceOf = (document: JsonMembers, providerKey: string): SourceReading => {
    if (crmIdOfProviderKey(providerKey) === null) return { ok: false, problem: "crm_id_invalid" }
    const basePath = crmBasePathOf(document)
    if (basePath === null) return { ok: false, problem: "base_path_invalid" }
    return { ok: true, source: { key: providerKey, basePath } }
}

/**
 * The ONE name of an operation (owner decided 2026-11-13): `nivo.api.crm.<crmId>.<method>.<path segments>`, the base path dropped
 * (`GET /v1/prices` of `crm.nivoweb` gives `nivo.api.crm.nivoweb.get.prices`); a node calls it and an interface reads it by it. Null for a
 * path outside the base path. The name is never parsed back into a path: the pinned document holds name to operation. It may still break
 * the law (a segment led by a digit or holding an underscore); the reading names it `tool_id_malformed`.
 */
export const operationNameOfPath = (source: OpenApiSource, method: string, path: string): string | null => {
    const crmId = crmIdOfProviderKey(source.key)
    return crmId === null ? null : crmOpNameOf(crmId, source.basePath, method, path)
}

/** The prefix of every operation of a CRM: `nivo.api.<providerKey>.` (`nivo.api.crm.nivoweb.`). */
export const sourcePrefixOf = (source: string): string => `${API_PREFIX}${source}.`

/** The same prefix, by the name the interface reads use. */
export const sourceApiPrefixOf = (source: string): string => sourcePrefixOf(source)

/** The CRM among `sources` (provider keys) an operation belongs to, or null when it belongs to none. */
export const sourceOfTool = (tool: string, sources: ReadonlyArray<string>): string | null =>
    sources.find((source) => tool.startsWith(sourcePrefixOf(source))) ?? null

/** The same, by the name the interface reads use. */
export const sourceOfApiVerb = (verb: string, sources: ReadonlyArray<string>): string | null => sourceOfTool(verb, sources)

/** The operation of a document a name names, or null when the document serves none under it. */
export const operationOfApiVerb = (document: PinnedDocument, verb: string): PinnedOperation | null =>
    document.operations.get(verb) ?? null

/** The effect an operation marks, or null when it marks none; any other value is noted as unsupported, so the operation cannot run. */
const effectOf = (operation: Json, reading: Reading): PinnedEffect | null => {
    const marked = operation[EFFECT]
    if (marked === undefined) return null
    const effect = PINNED_EFFECTS.find((entry) => entry === marked)
    if (effect === undefined) reading.note("effect mark is not money, irreversible or none")
    return effect ?? null
}

/** The types a parameter may have: one value, written as text in the path, the query or a header. */
const PRIMITIVES: ReadonlySet<string> = new Set(["string", "integer", "number", "boolean"])

type Json = JsonMembers

const recordOf = (value: unknown): Json => (isRecord(value) ? value : {})

/** The order of two member names by code point. */
const byCodePoint = (a: string, b: string): number => {
    if (a === b) return 0
    return a < b ? -1 : 1
}

function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((entry: unknown) => canonical(entry))
    if (!isRecord(value)) return value
    return Object.fromEntries(
        Object.keys(value)
            .toSorted(byCodePoint)
            .map((key) => [key, canonical(value[key])]),
    )
}

/** A JSON value as text with the members of every object in code-point order: the same value always gives the same text. */
export const canonicalJsonOf = (value: unknown): string => JSON.stringify(canonical(value))

/** The pin of a document: the sha256 of its canonical JSON, lowercase hex. */
export const documentShaOf = (document: unknown): string =>
    createHash("sha256").update(canonicalJsonOf(document)).digest("hex")

/** What one operation read needs besides its path item: the shared `components` and the declared source. */
interface OperationContext {
    /** `components` of the document. */
    readonly components: Json
    /** The source the document declares. */
    readonly source: OpenApiSource
}

/** What reading one part of an operation carries: the document's components and where unsupported features are noted. */
interface Reading {
    /** `components` of the document. */
    readonly components: Json
    /** Notes one unsupported feature. */
    readonly note: (feature: string) => void
}

/** An operation read, with the problem of its tool id when it has one. */
interface ReadOperation {
    /** The operation. */
    readonly operation: PinnedOperation
    /** Why its id cannot be pinned, or null. */
    readonly problem: ToolIdProblemCode | null
}

/** Why the name of an operation cannot be pinned, or null when it obeys the law of a CRM operation. */
const nameProblemOf = (name: string, reading: Reading): ToolIdProblemCode | null => {
    if (isCrmOp(name)) return null
    reading.note("operation name breaks the name law")
    return "tool_id_malformed"
}

/** A component a `$ref` names in one section of `components`, or the value itself when it is no reference. */
const derefOf = (raw: unknown, section: string, reading: Reading): Json => {
    const value = recordOf(raw)
    if (typeof value.$ref !== "string") return value
    const prefix = `#/components/${section}/`
    const named = value.$ref.startsWith(prefix) ? recordOf(reading.components[section])[value.$ref.slice(prefix.length)] : undefined
    if (!isRecord(named)) reading.note("unresolved $ref")
    return recordOf(named)
}

const schemaOf = (raw: unknown, reading: Reading): SchemaNode => {
    const resolved = resolvedSchemaOf(raw, recordOf(reading.components.schemas))
    for (const feature of resolved.unsupported) reading.note(feature)
    return resolved.node
}

const parameterOf = (raw: unknown, reading: Reading): ReadonlyArray<PinnedParameter> => {
    const parameter = derefOf(raw, "parameters", reading)
    const { name } = parameter
    const where = parameter.in
    if (typeof name !== "string" || name === "") return []
    if (where !== "path" && where !== "query" && where !== "header") {
        reading.note(where === "cookie" ? "cookie parameter" : "parameter location")
        return []
    }
    const schema = schemaOf(parameter.schema, reading)
    const types = typesOf(schema)
    if (parameter.content !== undefined || types === null || types.some((type) => !PRIMITIVES.has(type))) {
        reading.note("array or object parameter")
    }
    return [{ name, in: where, required: where === "path" || parameter.required === true, schema }]
}

/** The parameters of an operation: those of its path, replaced by the operation's own of the same name and place. */
const parametersOf = (path: Json, operation: Json, reading: Reading): ReadonlyArray<PinnedParameter> => {
    const lists: ReadonlyArray<unknown> = [path.parameters, operation.parameters]
    const all = lists.flatMap((list) => (Array.isArray(list) ? list : []).flatMap((raw: unknown) => parameterOf(raw, reading)))
    return [...new Map(all.map((parameter) => [`${parameter.in}:${parameter.name.toLowerCase()}`, parameter])).values()]
}

const bodyOf = (operation: Json, reading: Reading): PinnedBody | null => {
    if (operation.requestBody === undefined) return null
    const body = derefOf(operation.requestBody, "requestBodies", reading)
    const media = recordOf(body.content)[JSON_MEDIA]
    if (!isRecord(media)) {
        reading.note("non-JSON body")
        return null
    }
    const schema = schemaOf(media.schema, reading)
    if (typesOf(schema)?.includes("object") !== true) reading.note("body is not an object")
    return { required: body.required === true, schema }
}

const responsesOf = (operation: Json, reading: Reading): Readonly<Record<string, SchemaNode | null>> =>
    Object.fromEntries(
        Object.entries(recordOf(operation.responses)).map(([status, raw]): [string, SchemaNode | null] => {
            const media = recordOf(derefOf(raw, "responses", reading).content)[JSON_MEDIA]
            return [status, isRecord(media) && media.schema !== undefined ? schemaOf(media.schema, reading) : null]
        }),
    )

const operationOf = (
    path: string,
    item: Json,
    member: string,
    method: PinnedMethod,
    context: OperationContext,
): ReadonlyArray<ReadOperation> => {
    const operation = item[member]
    const name = operationNameOfPath(context.source, method, path)
    if (!isRecord(operation) || name === null) return []
    const found = new Set<string>()
    const reading: Reading = {
        components: context.components,
        note: (feature) => {
            found.add(feature)
        },
    }
    const parameters = parametersOf(item, operation, reading)
    const body = bodyOf(operation, reading)
    const members = new Set(Object.keys(body === null ? {} : declaredPropertiesOf(body.schema)))
    if (parameters.some((parameter) => parameter.in !== "header" && members.has(parameter.name))) {
        reading.note("a parameter and a body member share a name")
    }
    const responses = responsesOf(operation, reading)
    const effect = effectOf(operation, reading)
    const marked = operation[CUSTOMER_PARAMETER]
    const customerParameter = typeof marked === "string" ? marked : null
    if (customerParameter !== null && !parameters.some((entry) => entry.in !== "header" && entry.name === customerParameter)) {
        reading.note("customer parameter names no path or query parameter")
    }
    return [
        {
            problem: nameProblemOf(name, reading),
            operation: {
                toolId: name,
                apiVerb: name,
                purpose: false,
                operationId: typeof operation.operationId === "string" ? operation.operationId : name,
                method,
                path,
                parameters,
                body,
                responses,
                customerAudience: operation[CUSTOMER_AUDIENCE] === true,
                customerParameter,
                effect,
                unsupported: [...found],
            },
        },
    ]
}

/** The header names of the `apiKey` security schemes a document declares, lower case. */
const securityHeadersOf = (components: Json): ReadonlyArray<string> =>
    Object.values(recordOf(components.securitySchemes)).flatMap((scheme) =>
        isRecord(scheme) && scheme.type === "apiKey" && scheme.in === "header" && typeof scheme.name === "string"
            ? [scheme.name.toLowerCase()]
            : [],
    )

/** The operations of a document under its base path, by tool id, and the ids that cannot be pinned. */
interface ReadOperations {
    /** The operations by tool id. */
    readonly operations: ReadonlyMap<string, PinnedOperation>
    /** The ids that cannot be pinned. */
    readonly problems: ReadonlyArray<ToolIdProblem>
}

/**
 * The operations of every path under the base path by tool id; a tool id or an API read two operations share is marked unsupported
 * on each of them (`tool_id_duplicate`).
 */
const operationsOf = (paths: Json, components: Json, source: OpenApiSource): ReadOperations => {
    const all = Object.entries(paths).flatMap(([path, item]) =>
        isRecord(item) && path.startsWith("/")
            ? METHODS.flatMap(([member, method]) => operationOf(path, item, member, method, { components, source }))
            : [],
    )
    const counts = new Map<string, number>()
    const reads = new Map<string, number>()
    for (const { operation } of all) {
        counts.set(operation.toolId, (counts.get(operation.toolId) ?? 0) + 1)
        reads.set(operation.apiVerb, (reads.get(operation.apiVerb) ?? 0) + 1)
    }
    const shared = (operation: PinnedOperation): boolean =>
        (counts.get(operation.toolId) ?? 0) > 1 || (reads.get(operation.apiVerb) ?? 0) > 1
    const problemOf = ({ operation, problem }: ReadOperation): ReadonlyArray<ToolIdProblem> => {
        const code = shared(operation) ? "tool_id_duplicate" : problem
        return code === null ? [] : [{ problem: code, toolId: operation.toolId, method: operation.method, path: operation.path }]
    }
    return {
        operations: new Map(
            all.map(({ operation }) => [
                operation.toolId,
                shared(operation) ? { ...operation, unsupported: [...operation.unsupported, "duplicate tool id"] } : operation,
            ]),
        ),
        problems: all.flatMap((entry) => problemOf(entry)),
    }
}

/**
 * Reads the text of an OpenAPI 3.0 / 3.1 document in JSON into the operations of the CRM whose provider key is `providerKey`
 * (`crm.nivoweb`). The document is data: only methods, paths, parameters and schemas are read; no summary, description or example is
 * kept, and a document never names its own CRM. A document that is too large, not JSON, Swagger 2.0, not OpenAPI 3 or without paths, or
 * a key that is no CRM's, is refused as a whole. Only the operations under the base path (`sourceOf`) are read, each under its ONE name
 * (`operationNameOfPath`); a name that cannot be pinned is named in `toolProblems`. An operation that uses an unsupported feature is kept
 * with the features named (`unsupported`) and cannot be called.
 */
export const readDocument = (text: string, providerKey: string): DocumentReading => {
    if (text.length > DOCUMENT_MAX_CHARS) return { ok: false, problem: "too_large" }
    const read = parseJsonText(text)
    if (!read.ok || !isRecord(read.value)) return { ok: false, problem: "not_json" }
    const document = read.value
    if (document.swagger !== undefined) return { ok: false, problem: "swagger_2" }
    const version = typeof document.openapi === "string" ? document.openapi : ""
    if (!/^3\.[01]\./u.test(version)) return { ok: false, problem: "not_openapi_3" }
    if (!isRecord(document.paths)) return { ok: false, problem: "no_paths" }
    const declared = sourceOf(document, providerKey)
    if (!declared.ok) return declared
    const components = recordOf(document.components)
    const { operations, problems } = operationsOf(document.paths, components, declared.source)
    return {
        ok: true,
        document: {
            sha256: documentShaOf(document),
            version,
            source: declared.source,
            operations,
            toolProblems: problems,
            securityHeaders: securityHeadersOf(components),
        },
    }
}
