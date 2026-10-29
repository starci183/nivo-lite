import type { SubjectType } from "./work-items.contracts"

/** Where a work item sits in its command chain. */
export interface ChainSpot {
    /** The item. */
    readonly id: string
    /** Its chain, or null when it opened none. */
    readonly chainId: string | null
    /** Its depth. */
    readonly depth: number
}

/** Where a work item sits in its chain; null when the workspace has no such item. */
export type OptionalChainSpot = ChainSpot | null

/** The depth of the deepest item of a chain; null when the chain has no item. */
export type OptionalChainDepth = number | null

/** What a command is checked against to find out whether the chain already ran it. */
export interface ChainRepeatQuery {
    /** The workspace. */
    readonly workspaceId: string
    /** The chain. */
    readonly chainId: string
    /** The action key. */
    readonly action: string
    /** The kind of record the command is about. */
    readonly subjectType: SubjectType
    /** The record the command is about; null when it names none. */
    readonly subjectId: string | null
    /** The dedupe key of the command itself, which does not count as a repeat. */
    readonly dedupeKey: string
}
