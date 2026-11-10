import type { AiMessage, RoutedKind } from "./ai.contracts"

/**
 * Prompt-cache breakpoints, by protocol. Anthropic caches only up to a breakpoint the request names, at most four per request (the
 * top-level one included; `@starci/ai-router` 0.7.0 refuses a fifth); an OpenAI-compatible upstream caches a prefix by itself and
 * gets no marker (the router would strip one anyway). A kind is a wire protocol, so this table is the one place that knows which
 * protocol takes markers: the common path never asks.
 *
 * The four layers of a node's call on `anthropic` (agent-sdk `host.ts`, "The layout of a model call"):
 *   L1 craft + tools, L2 shop rules, L3 step goal + schema: one explicit breakpoint per layer end the prompt marks (`cacheMark`), at
 *   most three; the host hands one string today, so the one mark sits at the end of L3 (the end of the stable part);
 *   L4: the automatic breakpoint (top-level `cache_control`), which Anthropic places on the last cacheable block of every request, so
 *   the turns of an agent loop reuse each other's prefix.
 */
export const CACHE_MARK_KINDS: Readonly<Record<RoutedKind, boolean>> = { anthropic: true, openai: false }

/** The most breakpoints one request may carry, the automatic one included (Anthropic's limit). */
export const MAX_CACHE_BREAKPOINTS = 4

/** The explicit breakpoints a prompt may carry beside the automatic one. */
export const MAX_EXPLICIT_MARKS = MAX_CACHE_BREAKPOINTS - 1

/** The breakpoint of a marked layer end: Anthropic's default five-minute entry. */
const EPHEMERAL = { type: "ephemeral" } as const

/** One text part of a message content, with a breakpoint when it is marked and the protocol takes markers. */
export type MarkedText =
    | string
    | ReadonlyArray<{ readonly type: "text"; readonly text: string; readonly cache_control?: { readonly type: "ephemeral" } }>

/** The content of a message as the wire carries it: plain text, or one text part with a breakpoint when marked. A marker never changes the text. */
export const markedContentOf = (content: string, marked: boolean, onTheWire: boolean): MarkedText =>
    marked && onTheWire ? [{ type: "text", text: content, cache_control: EPHEMERAL }] : content

/**
 * The messages of a prompt with at most `MAX_EXPLICIT_MARKS` marks, the first ones kept (the earliest layers are the ones other
 * calls share); every later mark is dropped, never the message.
 */
export const withinMarkLimit = (messages: ReadonlyArray<AiMessage>): Array<AiMessage> => {
    let kept = 0
    return messages.map((message) => {
        if (message.cacheMark !== true) return message
        kept += 1
        if (kept <= MAX_EXPLICIT_MARKS) return message
        const { cacheMark: _dropped, ...rest } = message
        return rest
    })
}

/**
 * The client fields that turn on the automatic breakpoint (top-level `cache_control`) for a protocol that takes markers: for
 * `anthropic`, `ChatAnthropic`'s `invocationKwargs`, merged into every request body it sends. Nothing for any other protocol.
 */
export const automaticCacheFieldsOf = (): Readonly<Partial<Record<RoutedKind, Readonly<Record<string, unknown>>>>> => ({
    anthropic: { invocationKwargs: { cache_control: EPHEMERAL } },
})
