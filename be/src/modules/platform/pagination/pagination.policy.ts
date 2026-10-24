import { HttpSecurityError, HttpSecurityErrorCode } from "@modules/platform/http-security"
import { isRecord, parseJsonText } from "@modules/platform/primitives"
import type {
    Connection,
    CreatedPageRow,
    NormalizedPage,
    PagePosition,
    PagePositionOf,
    PageQueryParameters,
    PageRequest,
    ReadPageRows,
} from "./pagination.contracts"

/** The default number of nodes returned by a main list. */
export const DEFAULT_PAGE_SIZE = 50
/** The greatest number of nodes any main list page may return. */
export const MAX_PAGE_SIZE = 100

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:0\d|1[0-5]):[0-5]\d)$/u
const BASE64URL = /^[\w-]+$/u

const invalidPage = (fields: string): HttpSecurityError =>
    new HttpSecurityError({ code: HttpSecurityErrorCode.RequestInvalid, params: { fields } })

const validTimestamp = (value: string): boolean => {
    if (!TIMESTAMP.test(value) || value.startsWith("0000-") || !Number.isFinite(Date.parse(value))) return false
    const day = value.slice(0, 10)
    const midnight = Date.parse(`${day}T00:00:00Z`)
    return new Date(midnight).toISOString().startsWith(day)
}

const cursorPosition = (value: unknown, scope: string): PagePosition | null => {
    if (
        !isRecord(value) ||
        value.v !== 1 ||
        value.scope !== scope ||
        typeof value.createdAt !== "string" ||
        typeof value.id !== "string" ||
        !UUID.test(value.id) ||
        !validTimestamp(value.createdAt)
    )
        return null
    return { createdAt: value.createdAt, id: value.id }
}

const decodeCursor = (cursor: string, scope: string): PagePosition => {
    if (cursor.length > 2048 || !BASE64URL.test(cursor)) throw invalidPage("after")
    const body = Buffer.from(cursor, "base64url")
    if (body.toString("base64url") !== cursor) throw invalidPage("after")
    const parsed = parseJsonText(body.toString("utf8"))
    const position = parsed.ok ? cursorPosition(parsed.value, scope) : null
    if (position === null) throw invalidPage("after")
    return position
}

/** Validates the size and cursor before a query; a cursor is bound to its workspace, list and filters through scope. */
export const normalizePage = (request: PageRequest, scope: string): NormalizedPage => {
    const first = request.first ?? DEFAULT_PAGE_SIZE
    if (!Number.isInteger(first) || first < 1 || first > MAX_PAGE_SIZE) throw invalidPage("first")
    const after = request.after === undefined || request.after === null ? null : decodeCursor(request.after, scope)
    return { first, after }
}

/** The shared SQL seek position and one-row lookahead of a validated forward page. */
export const pageQueryParameters = (page: NormalizedPage): PageQueryParameters => [
    page.after?.createdAt ?? null,
    page.after?.id ?? null,
    page.first + 1,
]

/** Trims the query's one extra row and encodes its last returned position without losing database timestamp precision. */
export const toConnection = <T>(
    rows: ReadonlyArray<T>,
    first: number,
    scope: string,
    positionOf: PagePositionOf<T>,
): Connection<T> => {
    const nodes = rows.slice(0, first)
    const last = nodes.at(-1)
    const endCursor =
        last === undefined
            ? null
            : Buffer.from(JSON.stringify({ v: 1, scope, ...positionOf(last) })).toString("base64url")
    return { nodes, pageInfo: { endCursor, hasNextPage: rows.length > first } }
}

/** Validates and reads one SQL keyset page, retaining its exact database position in the connection cursor. */
export const readConnection = async <T extends CreatedPageRow>(
    request: PageRequest,
    scope: string,
    readRows: ReadPageRows<T>,
): Promise<Connection<T>> => {
    const page = normalizePage(request, scope)
    const rows = await readRows(pageQueryParameters(page))
    return toConnection(rows, page.first, scope, (row) => ({ createdAt: row.created_at, id: row.id }))
}
