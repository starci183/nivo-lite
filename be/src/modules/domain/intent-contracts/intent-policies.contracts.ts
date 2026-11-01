import type { IntentCheckKey, IntentFrame, IntentResultKind } from "./intent-contracts.contracts"

/** The part of an authority action a frame needs: its key and whether an amount limits it. */
export interface FrameAction {
    /** The action key, which is the intent. */
    readonly action: string
    /** True when an amount decides whether it runs alone; the generic frame of the action then runs in a turn of its own. */
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

/** What a check reads: the intent that was picked and its result as the schema parsed it. */
export interface CheckInput {
    /** The intent picked. */
    readonly intent: string
    /** The result. */
    readonly result: Readonly<Record<string, unknown>>
}

/** A check answers true when the result passes. */
export type IntentCheck = (input: CheckInput) => boolean

/** The answer of a schema that read a result: the result as parsed, or a refusal. A schema of the zod library fits. */
export type IntentSchemaAnswer =
    { readonly success: true; readonly data: Readonly<Record<string, unknown>> } | { readonly success: false }

/** A schema of a result: it reads an unknown value and bounds it. */
export interface IntentResultSchema {
    /** Reads a value without throwing. */
    safeParse(value: unknown): IntentSchemaAnswer
}

/** What a domain brings to the registry: its frames, the schema of each kind of result it uses, and the function of each check. */
export interface IntentDomain {
    /** The frames of its intents. */
    readonly frames: ReadonlyArray<IntentFrame>
    /** The schema of each kind of result it defines, by key. */
    readonly results: Readonly<Record<IntentResultKind, IntentResultSchema>>
    /** The function of each check it defines, by key. */
    readonly checks: Readonly<Record<IntentCheckKey, IntentCheck>>
}

/** A schema, or undefined when none is registered under the key. */
export type OptionalResultSchema = IntentResultSchema | undefined

/** A check, or undefined when none is registered under the key. */
export type OptionalIntentCheck = IntentCheck | undefined

/** What reading a result needs from the registry. */
export interface IntentLookup {
    /** The schema registered under a key, or undefined. */
    resultSchemaOf(kind: IntentResultKind): OptionalResultSchema
    /** The check registered under a key, or undefined. */
    checkOf(key: IntentCheckKey): OptionalIntentCheck
}
