import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { KnowledgeSourcesErrorCode } from "./errors/knowledge-sources.error"
import { MAX_UPLOAD_BYTES, WORKSPACE_SOURCE_BYTES } from "./knowledge-sources.contracts"
import type { NormalizedSource } from "./source-input.policy"

const BYTES_PER_MB = 1024 * 1024

/** Megabytes with one decimal, as the error texts print them. */
export const megabytesOf = (bytes: number): string => (Math.round((bytes / BYTES_PER_MB) * 10) / 10).toFixed(1)

/** The raw bytes a new source holds: the stored file, or the pasted text; a link holds none until it is read. */
export const rawBytesOf = (source: NormalizedSource, fileBytes: number): number => {
    if (source.kind === "file") return fileBytes
    return source.kind === "url" ? 0 : Buffer.byteLength(source.content, "utf8")
}

/** Whether a source of `incoming` raw bytes fits a workspace that already holds `used`; refuses with the sizes the text prints. */
export const quotaVerdict = (used: number, incoming: number): Outcome<number, KnowledgeSourcesErrorCode> => {
    if (incoming > MAX_UPLOAD_BYTES) {
        return refused(KnowledgeSourcesErrorCode.FileTooLarge, {
            size: megabytesOf(incoming),
            max: megabytesOf(MAX_UPLOAD_BYTES),
        })
    }
    if (used + incoming > WORKSPACE_SOURCE_BYTES) {
        return refused(KnowledgeSourcesErrorCode.QuotaExceeded, {
            size: megabytesOf(incoming),
            used: megabytesOf(used),
            left: megabytesOf(Math.max(0, WORKSPACE_SOURCE_BYTES - used)),
            limit: megabytesOf(WORKSPACE_SOURCE_BYTES),
        })
    }
    return ok(used + incoming)
}
