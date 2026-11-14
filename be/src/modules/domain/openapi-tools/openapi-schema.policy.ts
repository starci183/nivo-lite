import { isRecord } from "@modules/platform/primitives"
import type { JsonMembers, OptionalText, SchemaNode } from "./openapi-tools.contracts"

/** The schema keywords the provider refuses: an operation whose schemas use one cannot be called. */
export const UNSUPPORTED_KEYWORDS: ReadonlyArray<string> = [
    "oneOf",
    "anyOf",
    "not",
    "pattern",
    "patternProperties",
    "discriminator",
    "if",
    "then",
    "else",
    "dependentSchemas",
    "dependentRequired",
    "prefixItems",
    "contains",
    "propertyNames",
    "unevaluatedProperties",
    "multipleOf",
    "$dynamicRef",
]

/** The keywords the validator enforces; `format` and every other annotation are carried by none of them and are not kept. */
const KEPT_KEYWORDS: ReadonlyArray<string> = [
    "type",
    "nullable",
    "enum",
    "const",
    "required",
    "minItems",
    "maxItems",
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "minLength",
    "maxLength",
]

const REFUSED: ReadonlySet<string> = new Set(UNSUPPORTED_KEYWORDS)
const SCHEMA_REF = "#/components/schemas/"

/** A schema resolved, with the unsupported features found on the way. */
export interface ResolvedSchema {
    /** The schema with every local reference replaced by what it names. */
    readonly node: SchemaNode
    /** The unsupported features it uses, by name, each once. */
    readonly unsupported: ReadonlyArray<string>
}

/** What the walk of one schema carries. */
interface Walk {
    /** `components.schemas` of the document. */
    readonly schemas: JsonMembers
    /** The references being resolved above this node. */
    readonly trail: ReadonlyArray<string>
    /** Where an unsupported feature is noted. */
    readonly note: (feature: string) => void
}

/** The schema a local reference names, walked; an empty schema, with the reason noted, when it cannot be followed. */
function referencedOf(ref: string, walk: Walk): SchemaNode {
    const name = ref.startsWith(SCHEMA_REF) ? ref.slice(SCHEMA_REF.length) : null
    if (name === null) {
        walk.note("external $ref")
        return {}
    }
    if (walk.trail.includes(name)) {
        walk.note("cyclic $ref")
        return {}
    }
    if (!Object.hasOwn(walk.schemas, name)) {
        walk.note("unresolved $ref")
        return {}
    }
    return nodeOf(walk.schemas[name], { ...walk, trail: [...walk.trail, name] })
}

/** The members of a schema that hold schemas, each walked. */
function childrenOf(raw: JsonMembers, walk: Walk): SchemaNode {
    const out: Record<string, unknown> = {}
    if (isRecord(raw.properties)) {
        out.properties = Object.fromEntries(
            Object.entries(raw.properties).map(([name, member]) => [name, nodeOf(member, walk)]),
        )
    }
    if (raw.items !== undefined) out.items = nodeOf(raw.items, walk)
    if (typeof raw.additionalProperties === "boolean") out.additionalProperties = raw.additionalProperties
    else if (raw.additionalProperties !== undefined) out.additionalProperties = nodeOf(raw.additionalProperties, walk)
    if (Array.isArray(raw.allOf)) out.allOf = raw.allOf.map((part: unknown) => nodeOf(part, walk))
    return out
}

function nodeOf(raw: unknown, walk: Walk): SchemaNode {
    if (!isRecord(raw)) return {}
    if (typeof raw.$ref === "string") return referencedOf(raw.$ref, walk)
    for (const keyword of Object.keys(raw)) {
        if (REFUSED.has(keyword)) walk.note(keyword)
    }
    const kept = Object.fromEntries(
        KEPT_KEYWORDS.filter((keyword) => raw[keyword] !== undefined).map((keyword) => [keyword, raw[keyword]]),
    )
    return { ...kept, ...childrenOf(raw, walk) }
}

/**
 * A schema of the document with its local references (`#/components/schemas/<name>`) resolved in place and only the keywords the
 * validator enforces kept, so no description, title or example of the document travels further. A keyword the provider refuses, a
 * reference outside the document, one that names nothing and one that names itself are noted as unsupported features.
 */
export const resolvedSchemaOf = (raw: unknown, schemas: JsonMembers): ResolvedSchema => {
    const found = new Set<string>()
    const node = nodeOf(raw, {
        schemas,
        trail: [],
        note: (feature) => {
            found.add(feature)
        },
    })
    return { node, unsupported: [...found] }
}

/** The JSON type of a value, an integer told from another number. */
const typeOf = (value: unknown): string => {
    if (value === null) return "null"
    if (Array.isArray(value)) return "array"
    if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number"
    return typeof value
}

/** What a schema names under `type`: one name, a list of names, or nothing. */
const namedTypesOf = (schema: SchemaNode): ReadonlyArray<unknown> => {
    if (typeof schema.type === "string") return [schema.type]
    return Array.isArray(schema.type) ? schema.type : []
}

/** The types a schema admits, or null when it names none. */
export const typesOf = (schema: SchemaNode): ReadonlyArray<string> | null => {
    const types = namedTypesOf(schema).filter((entry): entry is string => typeof entry === "string")
    if (types.length === 0) return null
    return schema.nullable === true ? [...types, "null"] : types
}

const admits = (types: ReadonlyArray<string>, actual: string): boolean =>
    types.includes(actual) || (actual === "integer" && types.includes("number"))

const numberOf = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null)

const boundProblemOf = (schema: SchemaNode, value: number): OptionalText => {
    const minimum = numberOf(schema.minimum)
    const maximum = numberOf(schema.maximum)
    const above = numberOf(schema.exclusiveMinimum)
    const below = numberOf(schema.exclusiveMaximum)
    if (minimum !== null && (schema.exclusiveMinimum === true ? value <= minimum : value < minimum)) return "minimum"
    if (maximum !== null && (schema.exclusiveMaximum === true ? value >= maximum : value > maximum)) return "maximum"
    if (above !== null && value <= above) return "exclusiveMinimum"
    return below !== null && value >= below ? "exclusiveMaximum" : null
}

const lengthProblemOf = (schema: SchemaNode, length: number, least: string, most: string): OptionalText => {
    const min = numberOf(schema[least])
    const max = numberOf(schema[most])
    if (min !== null && length < min) return least
    return max !== null && length > max ? most : null
}

/** A keyword a value breaks, placed: `<path>: <keyword>`; null when it breaks none. */
const placed = (at: string, keyword: OptionalText): OptionalText => (keyword === null ? null : `${at}: ${keyword}`)

/** The violation of one member of an object: against its declared schema, else against what the schema says of other members. */
function extraProblemOf(schema: SchemaNode, member: unknown, at: string): OptionalText {
    const extra = schema.additionalProperties
    if (extra === false) return `${at}: not declared`
    return isRecord(extra) ? violationOf(extra, member, at) : null
}

/** The first violation among the members of an object, or null. */
function memberProblemOf(schema: SchemaNode, value: JsonMembers, prefix: string): OptionalText {
    const properties = isRecord(schema.properties) ? schema.properties : {}
    const required: ReadonlyArray<unknown> = Array.isArray(schema.required) ? schema.required : []
    const missing = required.find((name) => typeof name === "string" && value[name] === undefined)
    if (typeof missing === "string") return `${prefix}${missing}: required`
    for (const [name, member] of Object.entries(value)) {
        const declared = properties[name]
        const at = `${prefix}${name}`
        const problem = isRecord(declared) ? violationOf(declared, member, at) : extraProblemOf(schema, member, at)
        if (problem !== null) return problem
    }
    return null
}

/** The first violation among the items of a list, or null. */
function itemProblemOf(schema: SchemaNode, value: ReadonlyArray<unknown>, at: string): OptionalText {
    const count = lengthProblemOf(schema, value.length, "minItems", "maxItems")
    if (count !== null) return `${at}: ${count}`
    if (!isRecord(schema.items)) return null
    const { items } = schema
    for (const [index, item] of value.entries()) {
        const problem = violationOf(items, item, `${at}[${index}]`)
        if (problem !== null) return problem
    }
    return null
}

/** The first violation of a part of `allOf`, or null. */
function partProblemOf(schema: SchemaNode, value: unknown, at: string): OptionalText {
    const parts: ReadonlyArray<unknown> = Array.isArray(schema.allOf) ? schema.allOf : []
    for (const part of parts) {
        const problem = isRecord(part) ? violationOf(part, value, at) : null
        if (problem !== null) return problem
    }
    return null
}

/** The violation of what the schema says of the value as a whole (`enum`, `const`, `type`), or null. */
const kindProblemOf = (schema: SchemaNode, value: unknown, at: string): OptionalText => {
    if (Array.isArray(schema.enum) && !schema.enum.includes(value)) return `${at}: enum`
    if (schema.const !== undefined && schema.const !== value) return `${at}: const`
    const types = typesOf(schema)
    return types !== null && !admits(types, typeOf(value)) ? `${at}: type` : null
}

/** The violation of what the schema says of the value's content (length, bounds, items, members), or null. */
function contentProblemOf(schema: SchemaNode, value: unknown, at: string): OptionalText {
    if (typeof value === "string") return placed(at, lengthProblemOf(schema, value.length, "minLength", "maxLength"))
    if (typeof value === "number") return placed(at, boundProblemOf(schema, value))
    if (Array.isArray(value)) return itemProblemOf(schema, value, at)
    const prefix = at === "" ? "" : `${at}.`
    return isRecord(value) ? memberProblemOf(schema, value, prefix) : null
}

/**
 * The first place a value does not fit a resolved schema, as `<path>: <keyword>` (a path and a keyword, never the value), or null
 * when it fits. Only the supported subset is judged; an annotation such as `format` is not.
 */
export function violationOf(schema: SchemaNode, value: unknown, at?: string): OptionalText {
    const place = at ?? ""
    return partProblemOf(schema, value, place) ?? kindProblemOf(schema, value, place) ?? contentProblemOf(schema, value, place)
}

/** The properties a schema declares, its own and those of every `allOf` part. */
export const declaredPropertiesOf = (schema: SchemaNode): Readonly<Record<string, SchemaNode>> => {
    const parts: ReadonlyArray<unknown> = Array.isArray(schema.allOf) ? schema.allOf : []
    const inherited = parts.flatMap((part) => (isRecord(part) ? Object.entries(declaredPropertiesOf(part)) : []))
    const own = Object.entries(isRecord(schema.properties) ? schema.properties : {}).flatMap(
        ([name, member]): Array<[string, SchemaNode]> => (isRecord(member) ? [[name, member]] : []),
    )
    return Object.fromEntries([...inherited, ...own])
}

/** The schema of the items of a list, its own or the first an `allOf` part declares. */
const itemsOf = (schema: SchemaNode): SchemaNode | null => {
    if (isRecord(schema.items)) return schema.items
    const parts: ReadonlyArray<unknown> = Array.isArray(schema.allOf) ? schema.allOf : []
    return parts.flatMap((part) => (isRecord(part) && isRecord(part.items) ? [part.items] : []))[0] ?? null
}

/**
 * A value cut down to what its schema declares: a member of an object that the schema's `properties` do not name is dropped (unless
 * `additionalProperties` admits it), at every depth, so nothing the document did not declare reaches a caller. An object whose schema
 * declares no property at all is free-form and kept as it is.
 */
export function projectedOf(schema: SchemaNode, value: unknown): unknown {
    if (Array.isArray(value)) {
        const items = itemsOf(schema)
        return items === null ? value : value.map((item: unknown) => projectedOf(items, item))
    }
    if (!isRecord(value)) return value
    const declared = declaredPropertiesOf(schema)
    if (Object.keys(declared).length === 0) return value
    const extra = schema.additionalProperties
    return Object.fromEntries(
        Object.entries(value).flatMap(([name, member]): Array<[string, unknown]> => {
            const own = declared[name]
            if (own !== undefined) return [[name, projectedOf(own, member)]]
            if (extra === true) return [[name, member]]
            return isRecord(extra) ? [[name, projectedOf(extra, member)]] : []
        }),
    )
}
