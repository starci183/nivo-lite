import type { OrderState } from "./customer-turns.contracts"

/** What a customer reply may say happened to the order, as this turn really left it. */
export interface ClaimTruth {
    /** An order of the customer is on record. */
    readonly recorded: boolean
    /** The order was confirmed. */
    readonly confirmed: boolean
    /** The order waits for a person's approval. */
    readonly awaitingApproval: boolean
}

/** One kind of action a reply can claim, and the words that claim it. */
interface ClaimWords {
    readonly kind: keyof ClaimTruth
    readonly pattern: RegExp
}

/** Who acts in a claim: the shop's own voice. */
const SHOP = String.raw`(?:em|m\u00ecnh|shop|b\u00ean em|b\u00ean m\u00ecnh|c\u1eeda h\u00e0ng|ch\u00fang t\u00f4i|t\u00f4i)`
const DONE = String.raw`(?:\u0111\u00e3|v\u1eeba)\s+(?:\u0111\u01b0\u1ee3c\s+)?`

/**
 * The claims a reply can make about an order, in the shop's words: sent to the owner for approval, confirmed (by the order or in the
 * shop's own voice) and recorded, in Vietnamese and English.
 */
const CLAIMS: ReadonlyArray<ClaimWords> = [
    { kind: "awaitingApproval", pattern: /(?<!\p{L})(?:duy\u1ec7t|approv)/iu },
    {
        kind: "confirmed",
        pattern: new RegExp(
            String.raw`\u0111\u01a1n(?: h\u00e0ng)?[^.!?]{0,40}${DONE}(?:x\u00e1c nh\u1eadn|ch\u1ed1t)|${SHOP}\s+${DONE}(?:x\u00e1c nh\u1eadn|ch\u1ed1t)|order (?:is|has been|was) confirmed|confirmed your order`,
            "iu",
        ),
    },
    {
        kind: "recorded",
        pattern: new RegExp(
            String.raw`${DONE}(?:ghi nh\u1eadn|ghi|l\u00ean|t\u1ea1o|nh\u1eadn)\s+(?:l\u1ea1i\s+)?\u0111\u01a1n|(?:placed|recorded|created) (?:your |the )?order`,
            "iu",
        ),
    },
]

/** A sentence ends at its mark and the space after it; the full stops inside "3.500.000" are not ends. */
const SENTENCES = /(?<=[.!?\u2026])\s+/u

/** The truth of a turn that left no order: nothing may be claimed. */
export const NO_ORDER: ClaimTruth = { recorded: false, confirmed: false, awaitingApproval: false }

/** What may be claimed about the order of a turn, from the state its work really reached. */
export const claimTruthOf = (state: OrderState | null | undefined): ClaimTruth => {
    if (state === "confirmed") return { recorded: true, confirmed: true, awaitingApproval: false }
    if (state === "awaiting_approval") return { recorded: true, confirmed: false, awaitingApproval: true }
    if (state === "recorded") return { recorded: true, confirmed: false, awaitingApproval: false }
    return NO_ORDER
}

/** True when the sentence claims an action that did not happen in this turn. */
const isFalseClaim = (sentence: string, truth: ClaimTruth): boolean =>
    CLAIMS.some((claim) => !truth[claim.kind] && claim.pattern.test(sentence))

/**
 * The reply with every sentence that claims an order action this turn did not take left out: a reply never tells the customer the order
 * was sent for approval, confirmed or recorded unless that happened in the same turn. A reply with nothing left becomes the neutral line;
 * a reply that claims nothing false leaves as it is.
 */
export const unclaimedReplyOf = (reply: string, truth: ClaimTruth, neutral: string): string => {
    const sentences = reply.split(SENTENCES)
    const kept = sentences.filter((sentence) => !isFalseClaim(sentence, truth))
    if (kept.length === sentences.length) return reply
    const text = kept.join(" ").trim()
    return text === "" ? neutral : text
}
