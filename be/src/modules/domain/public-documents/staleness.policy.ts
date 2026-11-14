import type { SourceState } from "@modules/domain/knowledge-sources"
import type { SourceRecordRef, ReviewedSourceRef } from "./public-documents.contracts"

/**
 * Whether a source changed since the owner approved a public document drafted from it: it is gone, it left the public area (it was
 * moved to the internal area, so customers may no longer read what it says), or its text hash differs. A hash that is null means the
 * text is being read again: the new text is not known yet, so the source counts as changed only once its hash is back and differs.
 */
export const hasChanged = (recorded: SourceRecordRef, current: SourceState | undefined): boolean => {
    if (current?.visibility !== "public") return true
    return current.contentHash !== null && current.contentHash !== recorded.contentHash
}

/** The ids of the recorded sources that changed. */
export const changedSourceIds = (
    recorded: ReadonlyArray<SourceRecordRef>,
    current: ReadonlyArray<SourceState>,
): ReadonlySet<string> => {
    const byId = new Map(current.map((state) => [state.id, state]))
    return new Set(
        recorded.filter((source) => hasChanged(source, byId.get(source.sourceId))).map((source) => source.sourceId),
    )
}

/** Captures every bound source, including absence; a temporarily unknown hash retains the last known text identity. */
export const reviewedSourcesOf = (
    recorded: ReadonlyArray<SourceRecordRef>,
    states: ReadonlyArray<SourceState>,
): ReadonlyArray<ReviewedSourceRef> =>
    recorded.map((source) => {
        const current = states.find((state) => state.id === source.sourceId) ?? null
        return {
            sourceId: source.sourceId,
            title: current?.title ?? source.title,
            contentHash: current?.contentHash ?? source.contentHash,
            current,
        }
    })

/** Changes since an explicit review: presence, audience or known text identity; an indexing pass alone does not invent a change. */
export const changedReviewSourceIds = (
    reviewed: ReadonlyArray<ReviewedSourceRef>,
    states: ReadonlyArray<SourceState>,
): ReadonlySet<string> => {
    const changed = reviewed.filter((source) => {
        const current = states.find((state) => state.id === source.sourceId)
        if (source.current === null) return current !== undefined
        if (current?.visibility !== source.current.visibility) return true
        return current.contentHash !== null && current.contentHash !== source.contentHash
    })
    return new Set(changed.map((source) => source.sourceId))
}
