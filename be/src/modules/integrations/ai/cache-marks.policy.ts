/**
 * Whether the explicit prompt-cache breakpoints of a prompt are put on the wire. Anthropic caches only up to a breakpoint the request
 * names (at most four per request); OpenRouter's upstreams cache a prefix by themselves. `@starci/ai-router` 0.5.0 carries no
 * breakpoint through its Messages adapter, so nothing is sent: a message marked `cacheMark` goes as plain text.
 *
 * 0.7.0 SEAM (the one-line change): set this to true once the installed router carries a text part's `cache_control` to Anthropic
 * (check its README for the exact field before flipping). The marks already sit where the layers end: the end of the stable part of a
 * node's call (`node-prompt.policy.ts`, after L1 craft + tools, L2 shop rules, L3 step + schema).
 */
export const CACHE_MARKS_ON_THE_WIRE = false

/** One text part of a message content, with a breakpoint when it is marked and marks go on the wire. */
export type MarkedText =
    | string
    | ReadonlyArray<{ readonly type: "text"; readonly text: string; readonly cache_control?: { readonly type: "ephemeral" } }>

/** The content of a message as the wire carries it: plain text, or one text part with a breakpoint when marked. */
export const markedContentOf = (content: string, marked: boolean, onTheWire: boolean = CACHE_MARKS_ON_THE_WIRE): MarkedText =>
    marked && onTheWire ? [{ type: "text", text: content, cache_control: { type: "ephemeral" } }] : content
