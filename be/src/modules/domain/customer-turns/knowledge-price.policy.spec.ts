import { Test } from "@nestjs/testing"
import { isKnownPrice, pricesInKnowledge } from "./knowledge-price.policy"
const SUBJECT = Symbol("knowledge-price.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { pricesInKnowledge, isKnownPrice } }],
    }).compile()
    return moduleRef.get<typeof import("./knowledge-price.policy")>(SUBJECT)
}

describe("pricesInKnowledge", () => {
    it("reads millions, thousands and plain amounts, once each", async () => {
        const subject = await build()

        expect(subject.pricesInKnowledge("5 tri\u1ec7u, 1,5tr, 500k, 500 nghin, 5.000.000 \u0111, 12000")).toEqual([
            5_000_000, 1_500_000, 500_000, 12_000,
        ])
    })

    it("ignores an empty knowledge, small counts, and a unit glued to a letter", async () => {
        const subject = await build()

        expect(subject.pricesInKnowledge(null)).toEqual([])
        expect(subject.pricesInKnowledge("3 cups and 999 notes")).toEqual([])
        expect(subject.pricesInKnowledge("5 tra and 500kg")).toEqual([])
    })

    it("drops a zero amount and keeps a grouped thousand", async () => {
        const subject = await build()

        expect(subject.pricesInKnowledge("0 trieu and 1.200.000")).toEqual([1_200_000])
        expect(subject.pricesInKnowledge("500 ng\u00e0n and 1,000")).toEqual([500_000, 1_000])
    })

    it("rejects overflowing amounts and grouped numbers below one thousand", async () => {
        const subject = await build()

        const overflow = "9".repeat(400)
        expect(subject.pricesInKnowledge(`${overflow} trieu; ${overflow}k; 0.001; 0,999`)).toEqual([])
    })

    it("structurally preserves an empty result when a scaled match has no amount capture", async () => {
        const subject = await build()

        // Real patterns require this capture; inject a malformed intermediate to pin the defensive fallback.
        const captures: [string] = ["5 trieu"]
        const malformed: RegExpExecArray = Object.assign(captures, { index: 0, input: "5 trieu" })
        const matchAll = jest.spyOn(String.prototype, "matchAll").mockImplementation(() => [malformed].values())
        try {
            expect(subject.pricesInKnowledge("5 trieu")).toEqual([])
        } finally {
            matchAll.mockRestore()
        }
    })
})

describe("isKnownPrice", () => {
    it("accepts the rounded amount the owner wrote", async () => {
        const subject = await build()

        expect(subject.isKnownPrice("5 trieu", 5_000_000.4)).toBe(true)
    })

    it.each([
        ["a missing knowledge", null, 5_000_000],
        ["an invented price", "5 trieu", 4_000_000],
        ["zero", "5 trieu", 0],
        ["a negative amount", "5 trieu", -1],
        ["a non-finite amount", "5 trieu", Number.NaN],
    ])("rejects %s", async (_label, knowledge, amount) => {
        const subject = await build()

        expect(subject.isKnownPrice(knowledge, amount)).toBe(false)
    })
})
