import { Test } from "@nestjs/testing"
import {
    COUNT_MAX,
    MIN_GAP_MS,
    QUOTE_MAX,
    REACTION_EMOJI,
    TAPS_PER_SECOND,
    TIMES_MAX,
    canonicalEmojiOf,
    quoteBodyOf,
    reactionsByMessageOf,
    reactionsOf,
    tapsAcceptedOf,
    timesOf,
} from "./team-chat-reaction.policy"
import type { ReactionRow } from "./team-chat-reaction.contracts"
import type { ChatMemberRef } from "./team-chat.contracts"

const SUBJECT = Symbol("team-chat-reaction.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { canonicalEmojiOf, quoteBodyOf, reactionsByMessageOf, reactionsOf, tapsAcceptedOf, timesOf },
            },
        ],
    }).compile()
    return moduleRef.get<{
        canonicalEmojiOf: typeof canonicalEmojiOf
        quoteBodyOf: typeof quoteBodyOf
        reactionsByMessageOf: typeof reactionsByMessageOf
        reactionsOf: typeof reactionsOf
        tapsAcceptedOf: typeof tapsAcceptedOf
        timesOf: typeof timesOf
    }>(SUBJECT)
}

const ME: ChatMemberRef = { memberKind: "user", memberId: "11111111-1111-4111-8111-111111111111" }
const YOU = "22222222-2222-4222-8222-222222222222"
const BOT = "33333333-3333-4333-8333-333333333333"
const MSG = "51111111-1111-4111-8111-111111111111"
const MSG2 = "52222222-1111-4111-8111-111111111111"
const HEART = "\u{2764}\u{FE0F}"
const THUMB = "\u{1F44D}"
const LAUGH = "\u{1F606}"

const row = (
    memberKind: "user" | "agent",
    memberId: string,
    emoji: string,
    count: number,
    messageId = MSG,
): ReactionRow => ({ messageId, memberKind, memberId, emoji, count })

describe("canonicalEmojiOf", () => {
    it("accepts each emoji of the picker as the picker spells it", async () => {
        const subject = await buildSubject()
        for (const emoji of REACTION_EMOJI) expect(subject.canonicalEmojiOf(emoji)).toBe(emoji)
    })

    it("reads a heart without its variation selector as the same heart", async () => {
        const subject = await buildSubject()
        expect(subject.canonicalEmojiOf("\u{2764}")).toBe(HEART)
    })

    it("refuses anything that is not one of the six", async () => {
        const subject = await buildSubject()
        expect(subject.canonicalEmojiOf("\u{1F4A9}")).toBeNull()
        expect(subject.canonicalEmojiOf("")).toBeNull()
        expect(subject.canonicalEmojiOf("hello")).toBeNull()
        expect(subject.canonicalEmojiOf(`${THUMB}${THUMB}`)).toBeNull()
    })
})

describe("timesOf", () => {
    it("is one tap when none is asked or the number is odd", async () => {
        const subject = await buildSubject()
        expect(subject.timesOf(null)).toBe(1)
        expect(subject.timesOf(undefined)).toBe(1)
        expect(subject.timesOf(Number.NaN)).toBe(1)
        expect(subject.timesOf(0)).toBe(1)
        expect(subject.timesOf(-4)).toBe(1)
    })

    it("keeps a whole number up to the bound of a call", async () => {
        const subject = await buildSubject()
        expect(subject.timesOf(7)).toBe(7)
        expect(subject.timesOf(7.9)).toBe(7)
        expect(subject.timesOf(TIMES_MAX + 50)).toBe(TIMES_MAX)
        expect(subject.timesOf(Number.POSITIVE_INFINITY)).toBe(1)
    })
})

describe("tapsAcceptedOf", () => {
    it("counts a first call in full, up to the bound of a call", async () => {
        const subject = await buildSubject()
        expect(subject.tapsAcceptedOf(1, null)).toBe(1)
        expect(subject.tapsAcceptedOf(12, null)).toBe(12)
        expect(subject.tapsAcceptedOf(TIMES_MAX, null)).toBe(TIMES_MAX)
    })

    it("refuses a call that follows the last tap within the minimum gap", async () => {
        const subject = await buildSubject()
        expect(subject.tapsAcceptedOf(1, { count: 3, idleMs: MIN_GAP_MS - 1 })).toBe(0)
        expect(subject.tapsAcceptedOf(1, { count: 3, idleMs: 0 })).toBe(0)
    })

    it("counts about what a human can tap in the time since the last call, and at least one", async () => {
        const subject = await buildSubject()
        expect(subject.tapsAcceptedOf(30, { count: 3, idleMs: MIN_GAP_MS })).toBe(
            1 + Math.floor((MIN_GAP_MS * TAPS_PER_SECOND) / 1000),
        )
        expect(subject.tapsAcceptedOf(30, { count: 3, idleMs: 600 })).toBe(8)
        expect(subject.tapsAcceptedOf(5, { count: 3, idleMs: 600 })).toBe(5)
        expect(subject.tapsAcceptedOf(30, { count: 3, idleMs: 60_000 })).toBe(TIMES_MAX)
    })

    it("never lets one member pass the bound of an emoji on a message", async () => {
        const subject = await buildSubject()
        expect(subject.tapsAcceptedOf(10, { count: COUNT_MAX - 4, idleMs: 60_000 })).toBe(4)
        expect(subject.tapsAcceptedOf(1, { count: COUNT_MAX, idleMs: 60_000 })).toBe(0)
    })
})

describe("reactionsOf", () => {
    it("sums every member's taps of an emoji and marks the viewer's own", async () => {
        const subject = await buildSubject()
        const reactions = subject.reactionsOf(
            [row("user", ME.memberId, THUMB, 3), row("user", YOU, THUMB, 2), row("agent", BOT, THUMB, 1)],
            ME,
        )
        expect(reactions).toEqual([{ emoji: THUMB, count: 6, mine: true, mineCount: 3 }])
    })

    it("does not take an agent for the viewer who has the same id", async () => {
        const subject = await buildSubject()
        const reactions = subject.reactionsOf([row("agent", ME.memberId, HEART, 4)], ME)
        expect(reactions).toEqual([{ emoji: HEART, count: 4, mine: false, mineCount: 0 }])
    })

    it("lists the most tapped first and breaks ties in the order of the picker", async () => {
        const subject = await buildSubject()
        const reactions = subject.reactionsOf(
            [row("user", YOU, LAUGH, 2), row("user", YOU, THUMB, 5), row("user", YOU, HEART, 2)],
            ME,
        )
        expect(reactions.map((reaction) => reaction.emoji)).toEqual([THUMB, HEART, LAUGH])
    })

    it("has nothing for no row", async () => {
        const subject = await buildSubject()
        expect(subject.reactionsOf([], ME)).toEqual([])
    })
})

describe("reactionsByMessageOf", () => {
    it("groups the rows by message and leaves a message without rows out", async () => {
        const subject = await buildSubject()
        const byMessage = subject.reactionsByMessageOf(
            [
                row("user", YOU, HEART, 1, MSG),
                row("user", ME.memberId, THUMB, 2, MSG2),
                row("user", YOU, THUMB, 1, MSG2),
            ],
            ME,
        )
        expect([...byMessage.keys()]).toEqual([MSG, MSG2])
        expect(byMessage.get(MSG)).toEqual([{ emoji: HEART, count: 1, mine: false, mineCount: 0 }])
        expect(byMessage.get(MSG2)).toEqual([{ emoji: THUMB, count: 3, mine: true, mineCount: 2 }])
    })
})

describe("quoteBodyOf", () => {
    it("puts the body on one line", async () => {
        const subject = await buildSubject()
        expect(subject.quoteBodyOf("  one\n\ntwo   three ")).toBe("one two three")
    })

    it("cuts a long body to the bound with an ellipsis", async () => {
        const subject = await buildSubject()
        const quote = subject.quoteBodyOf("x".repeat(QUOTE_MAX + 20))
        expect(quote).toHaveLength(QUOTE_MAX)
        expect(quote.endsWith("\u{2026}")).toBe(true)
        expect(subject.quoteBodyOf("x".repeat(QUOTE_MAX))).toHaveLength(QUOTE_MAX)
    })
})
