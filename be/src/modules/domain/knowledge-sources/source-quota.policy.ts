import type { ErrorParams } from "@modules/platform/errors"
import { ok, refused, type Outcome } from "@modules/platform/primitives"
import { KnowledgeSourcesErrorCode } from "./errors/knowledge-sources.error"
import {
    BRAIN_AREA_BYTES,
    BRAIN_DOCUMENTS_BYTES,
    MAX_UPLOAD_BYTES,
    type DocumentVisibility,
} from "./knowledge-sources.contracts"
import { DOCUMENT_AREAS, type AreaHeld, type AreasUsage } from "./source-areas.contracts"
import type { NormalizedSource } from "./source-input.policy"

const BYTES_PER_MB = 1024 * 1024

/** Megabytes with one decimal, as the error texts print them. */
export const megabytesOf = (bytes: number): string => (Math.round((bytes / BYTES_PER_MB) * 10) / 10).toFixed(1)

/** The raw bytes a new source holds: the stored file, or the pasted text; a link holds none until it is read. */
export const rawBytesOf = (source: NormalizedSource, fileBytes: number): number => {
    if (source.kind === "file") return fileBytes
    return source.kind === "url" ? 0 : Buffer.byteLength(source.content, "utf8")
}

/** The refusal of each area when it is full: the text names the area in its own language. */
const AREA_FULL: Readonly<Record<DocumentVisibility, KnowledgeSourcesErrorCode>> = {
    public: KnowledgeSourcesErrorCode.PublicAreaFull,
    internal: KnowledgeSourcesErrorCode.InternalAreaFull,
}

/** The sizes a full allowance prints (megabytes) and the web reads (exact bytes). */
const sizesOf = (used: number, incoming: number, limit: number): ErrorParams => ({
    size: megabytesOf(incoming),
    used: megabytesOf(used),
    left: megabytesOf(Math.max(0, limit - used)),
    limit: megabytesOf(limit),
    fileBytes: incoming,
    usedBytes: used,
    leftBytes: Math.max(0, limit - used),
    limitBytes: limit,
})

/**
 * Whether a source of `incoming` raw bytes fits a workspace that already holds `used` of its `limit`; refuses with the sizes the text
 * prints. One document is never larger than `MAX_UPLOAD_BYTES`, whatever the plan.
 */
export const quotaVerdict = (
    used: number,
    incoming: number,
    limit: number = BRAIN_DOCUMENTS_BYTES,
): Outcome<number, KnowledgeSourcesErrorCode> => {
    if (incoming > MAX_UPLOAD_BYTES) {
        return refused(KnowledgeSourcesErrorCode.FileTooLarge, {
            size: megabytesOf(incoming),
            max: megabytesOf(MAX_UPLOAD_BYTES),
        })
    }
    if (used + incoming > limit) {
        // The text prints megabytes; the web reads the exact bytes (`fileBytes`, `usedBytes`, `leftBytes`, `limitBytes`) and names the file
        // itself (the owner's approved drawing brain-limit-50mb, case 3).
        return refused(KnowledgeSourcesErrorCode.QuotaExceeded, sizesOf(used, incoming, limit))
    }
    return ok(used + incoming)
}

/**
 * Whether `incoming` raw bytes fit the AREA they go into (an upload, a file replacement's growth, a document moved in), with the area's
 * own numbers: refused `KNOWLEDGE_SOURCES_PUBLIC_AREA_FULL` / `..._INTERNAL_AREA_FULL` with `area` and that area's used / left / limit.
 * The workspace's whole limit is checked after it (`quotaVerdict`); two areas of `BRAIN_AREA_BYTES` are that limit, so it binds only
 * if the numbers ever part. Answers the area's bytes after the write.
 */
export const areaVerdict = (
    held: AreasUsage,
    area: DocumentVisibility,
    incoming: number,
    limit: number = BRAIN_AREA_BYTES,
): Outcome<number, KnowledgeSourcesErrorCode> => {
    const used = held[area].usedBytes
    if (incoming > MAX_UPLOAD_BYTES || used + incoming <= limit) {
        const total = DOCUMENT_AREAS.reduce((sum, one) => sum + held[one].usedBytes, 0)
        const whole = quotaVerdict(total, incoming)
        return whole.kind === "ok" ? ok(used + incoming) : whole
    }
    return refused(AREA_FULL[area], { area, ...sizesOf(used, incoming, limit) })
}

/** The raw bytes and documents of each area as the aggregate read them, with the area's limit and what is left. */
export const areasUsageOf = (
    held: Readonly<Record<DocumentVisibility, AreaHeld>>,
    limit: number = BRAIN_AREA_BYTES,
): AreasUsage => ({
    public: {
        usedBytes: held.public.used,
        limitBytes: limit,
        leftBytes: Math.max(0, limit - held.public.used),
        count: held.public.count,
    },
    internal: {
        usedBytes: held.internal.used,
        limitBytes: limit,
        leftBytes: Math.max(0, limit - held.internal.used),
        count: held.internal.count,
    },
})
