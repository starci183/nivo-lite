/** The schema name a Brain document seed carries. */
export const BRAIN_SEED_SCHEMA = "nivo/brain-seed@1"

/** Who may read a seeded document: customers see `public`, only the workspace sees `internal`. */
export type BrainSeedVisibility = "public" | "internal"

/** One document of the Brain of a workspace: the title is its key within the origin. */
export interface BrainSeedDocument {
    /** The title; with the origin it finds the document again on a rerun. */
    readonly title: string
    /** The topic label shown in the Second Brain. */
    readonly topic: string
    /** Who may read it. */
    readonly visibility: BrainSeedVisibility
    /** The module that reads it; null = every module. */
    readonly module: string | null
    /** The markdown text. */
    readonly content: string
}

/** A Brain seed document read from the stack seed step: the origin marks the documents of one seed. */
export interface BrainSeed {
    /** The origin that marks the documents of this seed, e.g. `seed:tiem-hoa`. */
    readonly origin: string
    /** The documents, in order. */
    readonly documents: ReadonlyArray<BrainSeedDocument>
}
