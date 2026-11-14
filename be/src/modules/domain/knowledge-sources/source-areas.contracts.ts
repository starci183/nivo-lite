import type { DocumentVisibility } from "./knowledge-sources.contracts"

/**
 * THE TWO UPLOAD AREAS of the Second Brain (owner 2026-11-12): PUBLIC documents and INTERNAL documents, a document's `visibility`.
 * A document's area is the audience of every passage and truth read from it; the founder moves a document between them.
 */

/** The two areas, in the order the page shows them. */
export const DOCUMENT_AREAS: ReadonlyArray<DocumentVisibility> = ["public", "internal"]

/** How much of one area's allowance the workspace has used. */
export interface AreaUsage {
    /** The raw bytes the area's sources hold now. */
    readonly usedBytes: number
    /** The most raw bytes the area may hold (`BRAIN_AREA_BYTES`). */
    readonly limitBytes: number
    /** What is left, never negative. */
    readonly leftBytes: number
    /** The documents of the area (a long file cut into parts counts once). */
    readonly count: number
}

/** An upload area, or undefined when the page names none (the workspace's whole limit is checked then). */
export type OptionalArea = DocumentVisibility | undefined

/** What one area's documents hold, as the aggregate reads them. */
export interface AreaHeld {
    /** Their raw bytes. */
    readonly used: number
    /** How many documents (a long file cut into parts counts once). */
    readonly count: number
}

/** The usage of each area. */
export type AreasUsage = Readonly<Record<DocumentVisibility, AreaUsage>>

/** How much of its raw document allowance a workspace has used. */
export interface KnowledgeUsage {
    /** The raw bytes its sources hold now. */
    readonly usedBytes: number
    /** The most raw bytes it may hold. */
    readonly limitBytes: number
    /** The documents it holds (a long file cut into parts counts once). */
    readonly count: number
    /** The same, for each of the two upload areas. */
    readonly areas: AreasUsage
}

/**
 * A document that changed area (the MOVE): the source and its later parts, its title, the area it left and the one it entered, and who
 * moved it. Its passages followed in the same transaction; its truths follow from this.
 */
export interface SourceMove {
    /** The first source and every later part of the document. */
    readonly sourceIds: ReadonlyArray<string>
    /** The title of the document. */
    readonly title: string
    /** The area it was in. */
    readonly from: DocumentVisibility
    /** The area it is in now. */
    readonly to: DocumentVisibility
    /** The member who moved it. */
    readonly movedBy: string
}

/** A move, or null when the change asked for no area. */
export type MaybeSourceMove = SourceMove | null

/** A whole document as a move reads it: its first source and every later part, with the first's title, area and origin. */
export interface WholeDocument {
    /** The first source, then the later parts. */
    readonly ids: ReadonlyArray<string>
    /** The title of the first part. */
    readonly title: string
    /** The stored visibility of the first part. */
    readonly visibility: string
    /** Where the first part came from. */
    readonly origin: string | null
}

/** A whole document, or null when it is gone. */
export type MaybeWholeDocument = WholeDocument | null
