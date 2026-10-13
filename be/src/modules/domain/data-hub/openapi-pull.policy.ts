import { createHash } from "node:crypto"
import { apiScalarText, getPath, isApiJsonObject, readApiJson } from "@modules/integrations/data-sources"
import type { OpenApiOperation, OpenApiPull } from "@modules/integrations/data-sources"
import type { DataRecordInput } from "./data-hub.contracts"

/** Items asked for per page. */
export const PULL_PAGE_SIZE = 100
/** Pages read per operation in one sync. */
export const PULL_MAX_PAGES = 20

const PAGE_PARAMS = ["page", "pageNumber", "page_number", "pageIndex", "p"]
const LIMIT_PARAMS = [
    "limit",
    "per_page",
    "perPage",
    "pageSize",
    "page_size",
    "size",
    "take",
    "top",
    "count",
    "maxResults",
]
const OFFSET_PARAMS = ["offset", "skip", "start"]
const NEXT_PATHS = [
    "next",
    "links.next",
    "_links.next.href",
    "paging.next",
    "pagination.next",
    "meta.next",
    "@odata.nextLink",
    "nextPage",
    "next_page_url",
    "next_url",
]
const DATE_FIELDS = ["updated_at", "updatedAt", "modified_at", "created_at", "createdAt", "date", "timestamp"]

/** The paging parameters an operation understands. */
export interface PullPaging {
    /** The page-number parameter, if any. */
    readonly pageParam: string | undefined
    /** The page-size parameter, if any. */
    readonly limitParam: string | undefined
    /** The offset parameter, if any (only when there is no page parameter). */
    readonly offsetParam: string | undefined
    /** The number of the first page. */
    readonly pageStart: number
}

/** Finds the paging parameters of an operation that the fixed query does not already set. */
export const pagingOf = (op: OpenApiOperation, pull: OpenApiPull): PullPaging => {
    const names = new Set(op.params.filter((param) => param.in === "query").map((param) => param.name))
    const fixed = new URLSearchParams(pull.fixedQuery)
    const free = (candidates: ReadonlyArray<string>): string | undefined =>
        candidates.find((name) => names.has(name) && !fixed.has(name))
    const pageParam = free(PAGE_PARAMS)
    return {
        pageParam,
        limitParam: free(LIMIT_PARAMS),
        offsetParam: pageParam ? undefined : free(OFFSET_PARAMS),
        pageStart: pageParam === "pageIndex" ? 0 : 1,
    }
}

/** The parameter values of one page. */
export const pageInput = (paging: PullPaging, page: number): Record<string, number> => {
    const input: Record<string, number> = {}
    if (paging.limitParam) input[paging.limitParam] = PULL_PAGE_SIZE
    if (paging.pageParam) input[paging.pageParam] = paging.pageStart + page
    if (paging.offsetParam) input[paging.offsetParam] = page * PULL_PAGE_SIZE
    return input
}

/** The "next page" link an answer offers (in the body or the Link header), resolved against `base`. */
export const nextLinkOf = (body: unknown, headers: Readonly<Record<string, string>>, base: URL): URL | null => {
    const candidates: Array<string> = []
    for (const path of NEXT_PATHS) {
        const value = getPath(body, path)
        if (typeof value === "string" && value) candidates.push(value)
        else if (isApiJsonObject(value) && typeof value.href === "string") candidates.push(value.href)
    }
    const link = headers.link?.match(/<([^>]+)>\s*;\s*rel="?next"?/iu)
    if (link?.[1]) candidates.push(link[1])
    for (const candidate of candidates) {
        if (URL.canParse(candidate, base.toString())) return new URL(candidate, base)
    }
    return null
}

/** The stable id of an item: the owner's id field, a common id field, or a hash of the item. */
export const idOf = (item: unknown, pull: OpenApiPull): string => {
    if (!isApiJsonObject(item))
        return createHash("sha1")
            .update(JSON.stringify(item) ?? "")
            .digest("hex")
            .slice(0, 24)
    const picked = apiScalarText(getPath(item, pull.idField))
    if (picked) return picked
    for (const key of ["id", "_id", "uuid", "code", "sku"]) {
        const value = apiScalarText(item[key])
        if (value) return value
    }
    return createHash("sha1").update(JSON.stringify(item)).digest("hex").slice(0, 24)
}

/** One hub row out of an item. */
export const toRecord = (item: unknown, pull: OpenApiPull): DataRecordInput => {
    const data = isApiJsonObject(item) ? item : { value: item }
    const title = apiScalarText(getPath(item, pull.titleField)) || apiScalarText(data.name) || apiScalarText(data.title)
    let occurredAt: string | null = null
    for (const field of DATE_FIELDS) {
        const value = data[field]
        if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
            occurredAt = value
            break
        }
    }
    return { externalId: idOf(item, pull), title, occurredAt, data }
}

/** Where a pull stopped when the time ran out. */
export interface PullCursor {
    /** The next page to read. */
    readonly page: number
    /** The next link to follow, or empty. */
    readonly link: string
}

/** The meta key of an operation's cursor. */
export const cursorKey = (opId: string): string => `cursor.${opId}`

/** Reads a stored cursor (null when none or broken). */
export const parseCursor = (raw: string | undefined): PullCursor | null => {
    if (!raw) return null
    const { value } = readApiJson(raw)
    if (!isApiJsonObject(value) || typeof value.page !== "number" || !Number.isInteger(value.page) || value.page < 0) {
        return null
    }
    return { page: value.page, link: typeof value.link === "string" ? value.link : "" }
}
