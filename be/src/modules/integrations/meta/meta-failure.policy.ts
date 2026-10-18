import type { MetaFailure } from "./meta.contracts"

/** What a Graph error carried. */
export interface GraphErrorFacts {
    /** The HTTP status. */
    readonly status?: number
    /** Meta's error code. */
    readonly code?: number | null
    /** Meta's error subcode. */
    readonly subcode?: number | null
    /** Meta's error text. */
    readonly message?: string
}

const RATE_CODES: ReadonlySet<number> = new Set([4, 17, 32, 613, 80006, 80002])

/** Graph error codes to a reason. Best effort from Meta's published error reference; an unknown code is `error`. */
export const classifyGraphError = (facts: GraphErrorFacts): MetaFailure => {
    const code = facts.code ?? null
    const sub = facts.subcode ?? null
    if (code === 190 || facts.status === 401) return "token"
    if ((code !== null && RATE_CODES.has(code)) || facts.status === 429) return "rate_limited"
    if (code === 10 && sub === 2018278) return "window_expired"
    if (code === 551 || (code === 100 && sub === 2018001) || sub === 2018108) return "recipient_unavailable"
    if (code === 10 || (code !== null && code >= 200 && code < 300)) return "permission"
    if (/already.*(replied|private)|private.*already/iu.test(facts.message ?? "")) return "already_replied"
    if (code === 100 && (sub === 33 || facts.status === 404)) return "not_found"
    return "error"
}
