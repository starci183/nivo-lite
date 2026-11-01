import type { IntentCheckKey, IntentFrame } from "./intent-contracts.contracts"

/** The part of an authority action a frame needs: its key and whether an amount limits it. */
export interface FrameAction {
    /** The action key, which is the intent. */
    readonly action: string
    /** True when an amount decides whether it runs alone. */
    readonly amountLimit: boolean
}

/** A frame, or null when the intent has none. */
export type OptionalIntentFrame = IntentFrame | null

/** The first check a result failed, or null when it passed them all. */
export type OptionalCheckKey = IntentCheckKey | null

/** The intent a turn is pinned to, or null on a first turn. */
export type PinnedIntent = string | null

/** A result split by ownership: what the picked intent keeps, and the names of the members dropped because another intent owns them. */
export interface OwnedSplit {
    /** The result without the members another offered intent owns. */
    readonly kept: Readonly<Record<string, unknown>>
    /** The members that were set and dropped. */
    readonly dropped: ReadonlyArray<string>
}

/** The words of a sentence of the message catalog in the language of the turn, so the policies stay pure and hold no wording. */
export type IntentSay = (key: string, params?: Readonly<Record<string, string | number>>) => string
