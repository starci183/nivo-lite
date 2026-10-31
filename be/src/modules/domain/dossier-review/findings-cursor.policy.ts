import { createHash } from "node:crypto"
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@modules/platform/pagination"
import { isRecord, parseJsonText } from "@modules/platform/primitives"
import { FINDING_SEVERITIES } from "./dossier-review.contracts"
import { DossierReviewError, DossierReviewErrorCode } from "./errors/dossier-review.error"
import type { FindingFilter, FindingSeverity } from "./dossier-review.contracts"

/** Where a page of findings ends: the severity rank, the last time the finding was seen and its id. */
export interface FindingPosition {
    /** 0 for critical to 3 for low. */
    readonly rank: number
    /** last_seen_at, ISO 8601. */
    readonly at: string
    /** The finding id. */
    readonly id: string
}

/** The page a findings list reads. */
export interface FindingPageRequest {
    /** How many findings. */
    readonly first: number
    /** Where the previous page ended, or null for the first page. */
    readonly after: FindingPosition | null
    /** The scope the cursor belongs to. */
    readonly scope: string
}

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu
const BASE64URL = /^[\w-]+$/u

const invalid = (fields: string): DossierReviewError =>
    new DossierReviewError({ code: DossierReviewErrorCode.PageInvalid, params: { fields } })

/** The rank of a severity: critical first. */
export const severityRank = (severity: FindingSeverity): number => FINDING_SEVERITIES.indexOf(severity)

/** The scope of a cursor: the workspace and every filter of the list, so a cursor of another list is refused. */
export const scopeOf = (workspaceId: string, filter: FindingFilter): string =>
    `dossier-findings:${createHash("sha256")
        .update(
            JSON.stringify([
                workspaceId,
                filter.dossierId ?? null,
                [...(filter.statuses ?? [])].sort((a, b) => a.localeCompare(b)),
                [...(filter.severities ?? [])].sort((a, b) => a.localeCompare(b)),
                filter.assigneeId ?? null,
                filter.unassigned ?? null,
                filter.draftsAwaiting ?? null,
            ]),
        )
        .digest("hex")
        .slice(0, 24)}`

const positionOf = (value: unknown, scope: string): FindingPosition | null => {
    if (!isRecord(value) || value.v !== 1 || value.scope !== scope) return null
    const { rank, at, id } = value
    if (typeof rank !== "number" || !Number.isInteger(rank) || rank < 0 || rank > 3) return null
    if (typeof at !== "string" || !Number.isFinite(Date.parse(at))) return null
    return typeof id === "string" && UUID.test(id) ? { rank, at, id } : null
}

/** The page a findings list reads: `first` 1 to 100 (50 by default) and the position of an opaque, versioned cursor of this scope. */
export const findingPageOf = (filter: FindingFilter, scope: string): FindingPageRequest => {
    const first = filter.first ?? DEFAULT_PAGE_SIZE
    if (!Number.isInteger(first) || first < 1 || first > MAX_PAGE_SIZE) throw invalid("first")
    const cursor = filter.after ?? null
    if (cursor === null) return { first, after: null, scope }
    if (cursor.length > 2048 || !BASE64URL.test(cursor)) throw invalid("after")
    const body = Buffer.from(cursor, "base64url")
    const parsed = parseJsonText(body.toString("utf8"))
    const after = parsed.ok ? positionOf(parsed.value, scope) : null
    if (after === null) throw invalid("after")
    return { first, after, scope }
}

/** The cursor of the last finding of a page. */
export const cursorOf = (position: FindingPosition, scope: string): string =>
    Buffer.from(JSON.stringify({ v: 1, scope, ...position })).toString("base64url")
