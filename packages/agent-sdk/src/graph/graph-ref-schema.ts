import { z } from "../schema/zod-entry"
import { isRecord } from "../schema/is-record"
import type { NodeOutcomeDeclaration, RefType } from "../node/memory.contracts"

/** A JSON Schema node. */
export type Json = Readonly<Record<string, unknown>>

/** The answer for a path no closed object has a member for. */
export const MISSING: Json = Object.freeze({ "x-missing": true })

/** The answer for a path whose schema says nothing (a union, a free-form object, no schema at all). */
export const UNTYPED: Json = Object.freeze({ "x-untyped": true })

const REF_TYPES: ReadonlySet<string> = new Set(["string", "number", "integer", "boolean", "object", "array", "null"])

const isRefType = (value: unknown): value is RefType => typeof value === "string" && REF_TYPES.has(value)

/** The JSON Schema of a zod schema; a schema that cannot be written as one is untyped, and says why. */
export const jsonSchemaOf = (schema: z.ZodType, io: "input" | "output"): Json => {
    try {
        return z.toJSONSchema(schema, { io, unrepresentable: "any" })
    } catch (cause) {
        return { "x-unrepresentable": cause }
    }
}

/** The JSON type a JSON Schema node holds; `unknown` for a union, a reference or no type. */
export const typeOfSchema = (schema: Json): RefType => {
    const type = schema["type"]
    if (isRefType(type)) return type
    if (Array.isArray(type)) {
        const kinds = type.filter((kind) => kind !== "null")
        return kinds.length === 1 ? typeOfSchema({ type: kinds[0] }) : "unknown"
    }
    const options = schema["anyOf"] ?? schema["oneOf"]
    if (Array.isArray(options)) {
        const kinds = [...new Set(options.filter(isRecord).map(typeOfSchema).filter((kind) => kind !== "null"))]
        const [only] = kinds
        return kinds.length === 1 && only !== undefined ? only : "unknown"
    }
    if (schema["const"] !== undefined) return typeOfSchema({ type: typeof schema["const"] })
    return Array.isArray(schema["enum"]) ? "string" : "unknown"
}

/** The schemas a union node may take, without null. */
export const branchesOf = (schema: Json): ReadonlyArray<Json> => {
    const options = schema["anyOf"] ?? schema["oneOf"]
    return Array.isArray(options) ? options.filter(isRecord).filter((option) => option["type"] !== "null") : [schema]
}

/** One step into a schema by a member name: the member's schema, `MISSING` or `UNTYPED`. */
const stepInto = (only: Json, name: string): Json => {
    if (only["type"] === "array") {
        if (!/^\d+$/.test(name)) return MISSING
        return isRecord(only["items"]) ? only["items"] : {}
    }
    const properties = only["properties"]
    const member = isRecord(properties) ? properties[name] : undefined
    if (isRecord(member)) return member
    const extra = only["additionalProperties"]
    if (isRecord(extra)) return extra
    return isRecord(properties) && extra === false ? MISSING : UNTYPED
}

/**
 * The JSON Schema at a path inside another: `MISSING` when an object closed to other members does not have a member, `UNTYPED` when
 * the schema says nothing there.
 */
export const schemaAt = (schema: Json, path: ReadonlyArray<string>): Json => {
    let current: Json = schema
    for (const name of path) {
        const [only, ...others] = branchesOf(current)
        if (only === undefined || others.length > 0) return UNTYPED
        current = stepInto(only, name)
        if (current === MISSING || current === UNTYPED) return current
    }
    return current
}

/** Whether a value of type `found` fits a param of type `expected`. */
export const fits = (expected: RefType, found: RefType): boolean =>
    expected === "unknown" ||
    found === "unknown" ||
    expected === found ||
    (expected === "number" && found === "integer") ||
    (expected === "integer" && found === "number")

/** The shape of a step failure, with the node's own `fields`. */
export const failureSchemaOf = (outcome: NodeOutcomeDeclaration | undefined): Json => ({
    type: "object",
    properties: {
        code: { type: "string" },
        messageKey: { type: "string" },
        message: { type: "string" },
        fields: outcome?.failure === undefined ? { type: "object" } : jsonSchemaOf(outcome.failure, "output"),
    },
    additionalProperties: false,
})
