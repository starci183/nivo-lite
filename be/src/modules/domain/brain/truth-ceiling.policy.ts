/**
 * THE CEILING of truths in force per business (owner 2026-11-11, concept truth-graph `ingestionTwoPaths`): the target is 2 MB of truth
 * text; it opens at the level the tests have proven, 5,000 truths, and is raised as larger levels pass. Both bounds hold and the first
 * one reached stops the automatic path. Today the COUNT binds: 5,000 truths are about 0.5 MB of text (a truth line is about 100 bytes),
 * so the 2 MB bound only binds once the count is raised to about 20,000. This file is the one place both numbers live.
 *
 * In force = `active` and `scheduled` (a value that waits for its start will be in force); superseded, rejected, retired and expired
 * versions do not count. The bytes of a truth are its subject, attribute, value and unit in UTF-8.
 *
 * The ceiling stops only what goes in force BY ITSELF (a document's truths applied directly): nothing is dropped, the rest wait as
 * proposals and the founder is told. What the founder states or approves himself is never refused by it.
 *
 * WHERE it is held: inside the write. The settle hands this ceiling to the facts store as the bound of each automatic apply
 * (`BrainFactsService.applyUnannounced`), and the store takes the workspace's in-force lock, counts, writes and counts again in one
 * transaction, so documents settling at the same time can never take the workspace above it together. The room a settle reads when
 * it starts (`roomOf`) only spares writes that cannot fit.
 */
export interface TruthCeiling {
    /** The most truths in force. */
    readonly truths: number
    /** The most bytes of truth text in force. */
    readonly bytes: number
}

/** The level the tests have proven, and the owner's target in bytes. */
export const TRUTH_CEILING: TruthCeiling = { truths: 5_000, bytes: 2 * 1024 * 1024 }

/** What a business holds in force now. */
export interface TruthsInForce {
    /** How many truths. */
    readonly truths: number
    /** Their text in bytes. */
    readonly bytes: number
}

/** The room left under the ceiling. */
export interface TruthRoom {
    /** How many more truths may go in force by themselves. */
    readonly truths: number
    /** How many more bytes of truth text. */
    readonly bytes: number
}

/** The room a business has left under the ceiling; never negative. */
export const roomOf = (held: TruthsInForce, ceiling: TruthCeiling = TRUTH_CEILING): TruthRoom => ({
    truths: Math.max(0, ceiling.truths - held.truths),
    bytes: Math.max(0, ceiling.bytes - held.bytes),
})

/** The text of a truth that counts against the ceiling. */
export interface TruthText {
    /** The subject as written. */
    readonly subjectLabel: string
    /** The attribute as written. */
    readonly attributeLabel: string
    /** The value. */
    readonly value: string
    /** The unit, or null. */
    readonly unit: string | null
}

/** The bytes one truth adds to what is in force. */
export const truthBytesOf = (truth: TruthText): number => Buffer.byteLength(`${truth.subjectLabel}${truth.attributeLabel}${truth.value}${truth.unit ?? ""}`, "utf8")

/** Whether one more truth of `bytes` fits the room. */
export const fits = (room: TruthRoom, bytes: number): boolean => room.truths >= 1 && room.bytes >= bytes

/** The room after one truth of `bytes` went in force. */
export const taken = (room: TruthRoom, bytes: number): TruthRoom => ({
    truths: Math.max(0, room.truths - 1),
    bytes: Math.max(0, room.bytes - bytes),
})

/** The largest value a 32-bit integer carries: what a count of bytes is capped at where the reader takes no more. */
const INT_MAX = 2_147_483_647

/** Megabytes with one decimal. */
const megabytesOf = (bytes: number): number => Math.round((bytes / (1024 * 1024)) * 10) / 10

/** What a workspace holds of its two allowances: raw documents against its plan's storage, truths in force against their ceiling. */
export interface KnowledgeUsageView {
    /** The raw bytes its documents hold now, capped at a 32-bit integer. */
    readonly usedBytes: number
    /** The most raw bytes it may hold, capped at a 32-bit integer (a plan's gigabytes do not fit one: read `limitMb`). */
    readonly limitBytes: number
    /** The megabytes its documents hold now, one decimal. */
    readonly usedMb: number
    /** The megabytes it may hold. */
    readonly limitMb: number
    /** The truths in force. */
    readonly truthsInForce: number
    /** The ceiling of truths in force. */
    readonly truthsCeiling: number
    /** The bytes of truth text in force. */
    readonly truthBytes: number
    /** The ceiling of truth text in force, in bytes. */
    readonly truthBytesCeiling: number
    /** The documents of the workspace against NIVO's 50 MB document limit (the documents tab's first gauge). */
    readonly documents: DocumentsUsage
    /** The truths in force against their ceiling (the second gauge). */
    readonly truths: TruthsUsage
}

/** The uploaded documents of one upload area against the area's limit. */
export interface AreaDocumentsUsage {
    /** The raw bytes they hold. */
    readonly usedBytes: number
    /** The most raw bytes the area may hold. */
    readonly limitBytes: number
    /** What the area has left. */
    readonly leftBytes: number
    /** How many documents. */
    readonly count: number
}

/** The uploaded documents of a workspace against its document limit. */
export interface DocumentsUsage {
    /** The raw bytes they hold. */
    readonly usedBytes: number
    /** The most raw bytes the workspace may hold: 10 MB. */
    readonly limitBytes: number
    /** How many documents. */
    readonly count: number
    /** The same per upload area (public, internal), each against its own limit. */
    readonly areas: Readonly<Record<"public" | "internal", AreaDocumentsUsage>>
}

/** The truths in force of a workspace against the ceiling of truths. */
export interface TruthsUsage {
    /** Truths in force (active and scheduled). */
    readonly count: number
    /** The most truths in force. */
    readonly limitCount: number
    /** Their text in bytes. */
    readonly usedBytes: number
    /** The most truth text in force, in bytes. */
    readonly limitBytes: number
}

/** The raw document allowance of a workspace as it is read. */
export interface RawUsage {
    /** The raw bytes its documents hold now. */
    readonly usedBytes: number
    /** The most raw bytes it may hold. */
    readonly limitBytes: number
    /** How many documents it holds. */
    readonly count: number
    /** The same per upload area. */
    readonly areas: Readonly<Record<"public" | "internal", AreaDocumentsUsage>>
}

/** The two allowances of a workspace in one view. */
export const knowledgeUsageOf = (raw: RawUsage, held: TruthsInForce, ceiling: TruthCeiling = TRUTH_CEILING): KnowledgeUsageView => ({
    usedBytes: Math.min(raw.usedBytes, INT_MAX),
    limitBytes: Math.min(raw.limitBytes, INT_MAX),
    usedMb: megabytesOf(raw.usedBytes),
    limitMb: megabytesOf(raw.limitBytes),
    truthsInForce: held.truths,
    truthsCeiling: ceiling.truths,
    truthBytes: held.bytes,
    truthBytesCeiling: ceiling.bytes,
    documents: {
        usedBytes: Math.min(raw.usedBytes, INT_MAX),
        limitBytes: Math.min(raw.limitBytes, INT_MAX),
        count: raw.count,
        areas: { public: { ...raw.areas.public }, internal: { ...raw.areas.internal } },
    },
    truths: { count: held.truths, limitCount: ceiling.truths, usedBytes: held.bytes, limitBytes: ceiling.bytes },
})
