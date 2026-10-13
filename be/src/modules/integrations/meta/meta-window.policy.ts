import {
    HUMAN_AGENT_WINDOW_MS,
    INSTAGRAM_MAX_BYTES,
    MESSENGER_MAX_CHARS,
    PRIVATE_REPLY_WINDOW_MS,
    STANDARD_WINDOW_MS,
} from "./meta.contracts"
import type {
    MessageTag,
    MetaPlatform,
    OptionalInstant,
    PrivateReplyVerdict,
    RateLimiter,
    WindowVerdict,
} from "./meta.contracts"

/**
 * May the Page message this person now? Only inside 24 hours of their last message; outside it only when HUMAN_AGENT was passed
 * explicitly (and then up to 7 days). No known inbound message means no window at all.
 */
export const checkMessagingWindow = (lastUserAt: OptionalInstant, now: number, tag?: MessageTag): WindowVerdict => {
    if (lastUserAt === null) return { ok: false, reason: "no_user_message" }
    const age = now - lastUserAt
    if (age <= STANDARD_WINDOW_MS) return { ok: true, via: "standard" }
    if (tag === "HUMAN_AGENT") {
        return age <= HUMAN_AGENT_WINDOW_MS
            ? { ok: true, via: "human_agent" }
            : { ok: false, reason: "human_agent_expired" }
    }
    return { ok: false, reason: "window_expired" }
}

/** May a private reply to this comment be sent now? Once per comment and only within 7 days of it. */
export const checkPrivateReply = (
    commentAt: OptionalInstant,
    alreadyReplied: boolean,
    now: number,
): PrivateReplyVerdict => {
    if (alreadyReplied) return { ok: false, reason: "already_replied" }
    if (commentAt === null) return { ok: false, reason: "comment_age_unknown" }
    return now - commentAt <= PRIVATE_REPLY_WINDOW_MS ? { ok: true } : { ok: false, reason: "private_reply_expired" }
}

const fits = (platform: MetaPlatform, text: string): boolean =>
    platform === "facebook"
        ? text.length <= MESSENGER_MAX_CHARS
        : Buffer.byteLength(text, "utf8") <= INSTAGRAM_MAX_BYTES

/** Splits a long text into messages the platform accepts, at a paragraph, line or space when it can. */
export const chunkMessage = (platform: MetaPlatform, text: string): Array<string> => {
    const out: Array<string> = []
    let rest = text.trim()
    while (rest.length > 0) {
        if (fits(platform, rest)) {
            out.push(rest)
            break
        }
        let cut = rest.length
        while (cut > 1 && !fits(platform, rest.slice(0, cut))) cut = Math.floor(cut * 0.9)
        while (cut < rest.length && fits(platform, rest.slice(0, cut + 1))) cut += 1
        const head = rest.slice(0, cut)
        const at = Math.max(
            head.lastIndexOf("\n\n"),
            head.lastIndexOf("\n"),
            head.lastIndexOf(". "),
            head.lastIndexOf(" "),
        )
        const end = at > cut * 0.5 ? at + 1 : cut
        out.push(rest.slice(0, end).trim())
        rest = rest.slice(end).trim()
    }
    return out.filter((chunk) => chunk.length > 0)
}

/**
 * A sliding-window limiter per key (the Page id). In memory: it protects one server process from bursting a Page into Meta's own
 * limits; the authoritative limit stays Meta's, whose error is mapped to `rate_limited`.
 */
export const createRateLimiter = (max: number, windowMs: number): RateLimiter => {
    const hits = new Map<string, Array<number>>()
    return {
        take: (key, now) => {
            const kept = (hits.get(key) ?? []).filter((at) => now - at < windowMs)
            if (kept.length >= max) {
                hits.set(key, kept)
                return false
            }
            hits.set(key, [...kept, now])
            return true
        },
    }
}
