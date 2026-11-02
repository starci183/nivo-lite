import { Test } from "@nestjs/testing"
import type { GraphEvidence } from "@modules/domain/work-items"
import { MONEY_AMOUNT, MONEY_SOURCE, MONEY_VIA, moneyFactsOf } from "./money-facts.policy"

/** The members of the subject under test. */
interface Subject {
    readonly moneyFactsOf: typeof moneyFactsOf
}

const SUBJECT = Symbol("money-facts.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { moneyFactsOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const amountOf = (value: number | null, kind: string, via: string): GraphEvidence => ({
    key: "amount_vnd",
    value,
    kind,
    via,
})
const claim = amountOf(300_000, "claimed", "chat_text")
const image = amountOf(450_000, "claimed", "chat_image")
const feed = amountOf(500_000, "received", "sepay")

describe("money-facts.policy moneyFactsOf evidence authority", () => {
    it("reads the amount, where it came from and the road it came by", async () => {
        const subject = await build()

        expect(subject.moneyFactsOf([claim], null)).toEqual({
            [MONEY_AMOUNT]: 300_000,
            [MONEY_SOURCE]: "claimed",
            [MONEY_VIA]: "chat_text",
        })
    })

    it("lets money received win over money claimed, whichever comes first", async () => {
        const subject = await build()

        expect(subject.moneyFactsOf([claim, feed], null)).toEqual({
            [MONEY_AMOUNT]: 500_000,
            [MONEY_SOURCE]: "received",
            [MONEY_VIA]: "sepay",
        })
        expect(subject.moneyFactsOf([feed, claim], null)[MONEY_SOURCE]).toBe("received")
    })

    it("leaves the amount unread when claimed amounts disagree, whichever comes first", async () => {
        const subject = await build()
        const smaller = amountOf(3_500_000, "claimed", "order_record")
        const larger = amountOf(17_500_000, "claimed", "chat_text")

        expect(subject.moneyFactsOf([smaller, larger], null)).toEqual({})
        expect(subject.moneyFactsOf([larger, smaller], null)).toEqual({})
    })

    it("leaves a missing or conflicting received amount unread rather than substituting a claim", async () => {
        const subject = await build()
        const unclear = amountOf(null, "received", "invoice_paid")

        expect(subject.moneyFactsOf([unclear, claim, image], null)).toEqual({})
        expect(subject.moneyFactsOf([feed, amountOf(700_000, "received", "invoice_paid")], null)).toEqual({})
        expect(subject.moneyFactsOf([feed, unclear, claim], null)).toEqual({})
    })

    it("reads agreeing claims without inventing an amount and ignores a lower-authority gap when receipt is known", async () => {
        const subject = await build()

        expect(subject.moneyFactsOf([claim, amountOf(300_000, "claimed", "chat_image")], null)[MONEY_AMOUNT]).toBe(
            300_000,
        )
        expect(subject.moneyFactsOf([amountOf(null, "claimed", "chat_text"), feed], null)[MONEY_AMOUNT]).toBe(500_000)
    })

    it("treats non-finite evidence as unread", async () => {
        const subject = await build()

        expect(subject.moneyFactsOf([amountOf(Number.POSITIVE_INFINITY, "claimed", "chat_text")], null)).toEqual({})
        expect(subject.moneyFactsOf([amountOf(Number.NaN, "claimed", "chat_text")], null)).toEqual({})
        expect(subject.moneyFactsOf([], Number.POSITIVE_INFINITY)).toEqual({})
        expect(subject.moneyFactsOf([], Number.NaN)).toEqual({})
    })
})

describe("money-facts.policy moneyFactsOf proposal and missing evidence", () => {
    it("ignores evidence that is not about an amount", async () => {
        const subject = await build()
        const other: GraphEvidence = { key: "currency", value: "VND", kind: "claimed", via: "chat_text" }

        expect(subject.moneyFactsOf([other], 5)).toEqual({
            [MONEY_AMOUNT]: 5,
            [MONEY_SOURCE]: "claimed",
            [MONEY_VIA]: "proposal",
        })
    })

    it("gives no facts to an amount entry with no value, so the branch falls to its else and the turn waits", async () => {
        const subject = await build()

        expect(subject.moneyFactsOf([amountOf(null, "claimed", "chat_image")], 5)).toEqual({})
    })

    it("uses the amount of the work as a claim via the proposal when the turn has no entry", async () => {
        const subject = await build()

        expect(subject.moneyFactsOf([], 7_200_000)).toEqual({
            [MONEY_AMOUNT]: 7_200_000,
            [MONEY_SOURCE]: "claimed",
            [MONEY_VIA]: "proposal",
        })
    })

    it("reads 0 from a source that is none for a turn with no entry and no amount, which is a reading and not a gap", async () => {
        const subject = await build()
        const none = { [MONEY_AMOUNT]: 0, [MONEY_SOURCE]: "none", [MONEY_VIA]: "none" }

        expect(subject.moneyFactsOf([], null)).toEqual(none)
        expect(subject.moneyFactsOf([], undefined)).toEqual(none)
    })

    it("answers nothing for a turn that carries no evidence list at all", async () => {
        const subject = await build()

        expect(subject.moneyFactsOf(undefined, 5)).toEqual({})
    })
})
