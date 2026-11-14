import type { OptionalZaloInboxFacts, ZaloInboxFactsRow } from "./zalo-inbox.contracts"

/** The later of two times, as ISO text; null when neither is given. */
const laterOf = (left: Date | undefined, right: Date | undefined): string | null => {
    if (left === undefined) return right === undefined ? null : right.toISOString()
    return right === undefined || left.getTime() >= right.getTime() ? left.toISOString() : right.toISOString()
}

/**
 * The facts of a connection's account: the last time is the newer of its newest event and its newest customer message, a customer message
 * kept is a text seen, a follower kept is a follow seen; null when the account keeps none of the three.
 */
export const zaloFactsOf = (
    newestEventAt: Date | undefined,
    newestMessageAt: Date | undefined,
    hasFollower: boolean,
): OptionalZaloInboxFacts => {
    if (newestEventAt === undefined && newestMessageAt === undefined && !hasFollower) return null
    const facts: ZaloInboxFactsRow = {
        last_at: laterOf(newestEventAt, newestMessageAt),
        has_text: newestMessageAt !== undefined,
        has_follow: hasFollower,
    }
    return facts
}
