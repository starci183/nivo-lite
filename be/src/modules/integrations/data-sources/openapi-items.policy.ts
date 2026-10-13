import { DataSourcesError, DataSourcesErrorCode } from "./errors/data-sources.error"
import type { OpenApiFieldGuess, OpenApiItemList } from "./openapi.contracts"
import { OPENAPI_TEXT } from "./messages/openapi.messages"

/** A plain JSON object. */
export type ApiJsonObject = Record<string, unknown>

/** What reading a JSON text gave: the value, or the failure that stopped it. */
export interface ApiJsonRead {
    /** The parsed value; undefined when the text is not JSON. */
    readonly value: unknown
    /** The parse failure, when there was one. */
    readonly cause?: unknown
}

/** True for a plain JSON object. */
export const isApiJsonObject = (value: unknown): value is ApiJsonObject =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** Reads a JSON text without throwing: the value, or the failure that stopped it. */
export const readApiJson = (raw: string): ApiJsonRead => {
    try {
        const value: unknown = JSON.parse(raw)
        return { value }
    } catch (cause) {
        return { value: undefined, cause }
    }
}

const ID_FIELDS = ["id", "_id", "uuid", "code", "sku", "key", "ID", "Id"]
const TITLE_FIELDS = [
    "name",
    "title",
    "full_name",
    "fullName",
    "display_name",
    "displayName",
    "label",
    "subject",
    "email",
    "code",
]

/** Id and title field names out of a list of property names. */
export const suggestFields = (keys: ReadonlyArray<string>): OpenApiFieldGuess => {
    const idField = ID_FIELDS.find((w) => keys.includes(w)) ?? keys.find((k) => /id$/iu.test(k)) ?? keys[0] ?? ""
    const titleField =
        TITLE_FIELDS.filter((t) => t !== idField).find((w) => keys.includes(w)) ?? keys.find((k) => k !== idField) ?? ""
    return { idField, titleField }
}

/** A value at a dotted path (like data.items); an empty path is the value itself. */
export const getPath = (value: unknown, path: string): unknown => {
    if (path.trim() === "") return value
    let current: unknown = value
    for (const key of path.trim().split(".")) {
        if (Array.isArray(current)) current = current[Number(key)]
        else if (isApiJsonObject(current)) current = current[key]
        else return undefined
    }
    return current
}

const NO_ITEMS: OpenApiItemList = { found: false, path: "", items: [] }

const walkForArray = (node: unknown, path: string, depth: number): OpenApiItemList => {
    if (!isApiJsonObject(node)) return NO_ITEMS
    for (const [key, child] of Object.entries(node)) {
        if (Array.isArray(child)) return { found: true, path: path ? `${path}.${key}` : key, items: child }
    }
    if (depth >= 2) return NO_ITEMS
    for (const [key, child] of Object.entries(node)) {
        const result = walkForArray(child, path ? `${path}.${key}` : key, depth + 1)
        if (result.found) return result
    }
    return NO_ITEMS
}

/** The first array in a response (itself, or the first array property up to two levels down). */
export const detectItems = (body: unknown): OpenApiItemList => {
    if (Array.isArray(body)) return { found: true, path: "", items: body }
    return walkForArray(body, "", 0)
}

/** Items of a response by the owner's path; falls back to the first array, then to the response as one item. */
export const itemsOf = (body: unknown, path: string): ReadonlyArray<unknown> => {
    const at = path.trim() ? getPath(body, path) : undefined
    if (Array.isArray(at)) return at
    const found = detectItems(body)
    if (found.found) return found.items
    return isApiJsonObject(body) ? [body] : []
}

/** Suggested id and title fields from the first items of a real response. */
export const suggestFromItems = (items: ReadonlyArray<unknown>): OpenApiFieldGuess => {
    const first = items.find(isApiJsonObject)
    return first ? suggestFields(Object.keys(first)) : { idField: "", titleField: "" }
}

/** The text of a value for an id or title (strings, numbers and booleans only). */
export const apiScalarText = (value: unknown): string => {
    if (typeof value === "string") return value
    return typeof value === "number" || typeof value === "boolean" ? String(value) : ""
}

/** Reads an answer body as JSON; a plain Vietnamese refusal when it is not. */
export const parseJsonBody = (text: string): unknown => {
    const read = readApiJson(text)
    if (read.cause !== undefined) {
        throw new DataSourcesError({
            code: DataSourcesErrorCode.Rejected,
            params: { detail: OPENAPI_TEXT.notJson },
            cause: read.cause,
        })
    }
    return read.value
}
