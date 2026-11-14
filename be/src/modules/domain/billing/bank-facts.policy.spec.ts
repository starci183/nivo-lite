import { Test } from "@nestjs/testing"
import { bankFactsOf, bankFactsOfCredit, bankTextOf, bankTimeOf } from "./bank-facts.policy"

const SUBJECT = Symbol("bank-facts.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { bankFactsOf, bankFactsOfCredit, bankTextOf, bankTimeOf } }],
    }).compile()
    return moduleRef.get<{
        bankFactsOf: typeof bankFactsOf
        bankFactsOfCredit: typeof bankFactsOfCredit
        bankTextOf: typeof bankTextOf
        bankTimeOf: typeof bankTimeOf
    }>(SUBJECT)
}

describe("bank facts policy > bankTextOf", () => {
    it("reads non-empty text trimmed and a finite number as its digits", async () => {
        const subject = await build()

        expect(subject.bankTextOf(" FT25309ABCD ")).toBe("FT25309ABCD")
        expect(subject.bankTextOf(525209999)).toBe("525209999")
    })

    it.each([[undefined], [null], [""], ["   "], [Number.NaN], [{}], [true]])("reads nothing from %p", async (value) => {
        const subject = await build()

        expect(subject.bankTextOf(value)).toBeUndefined()
    })
})

describe("bank facts policy > bankTimeOf", () => {
    it("reads a zone-less booking time as Vietnam time and a zoned ISO time as it is", async () => {
        const subject = await build()

        expect(subject.bankTimeOf("2026-11-05 14:02:37")).toBe("2026-11-05T07:02:37.000Z")
        expect(subject.bankTimeOf("2026-11-05T14:02:37+07:00")).toBe("2026-11-05T07:02:37.000Z")
        expect(subject.bankTimeOf("2026-11-05T07:02:37.120Z")).toBe("2026-11-05T07:02:37.120Z")
    })

    it.each([[undefined], [""], ["05/11/2026 14:02"], ["2026-13-45 99:99:99"], ["2026-11-05T14:02:37"], [1730790157]])(
        "reads no time from %p",
        async (value) => {
            const subject = await build()

            expect(subject.bankTimeOf(value)).toBeUndefined()
        },
    )
})

describe("bank facts policy > bankFactsOf", () => {
    it("keeps each fact that is given and adds no member for one that is not", async () => {
        const subject = await build()

        expect(subject.bankFactsOf("FT1", "0123", "2026-11-05 14:02:37")).toEqual({
            bankRef: "FT1",
            account: "0123",
            occurredAt: "2026-11-05T07:02:37.000Z",
        })
        const none = subject.bankFactsOf(undefined, "", "later")
        expect(Object.keys(none)).toEqual([])
    })

    it("copies a reading's facts member by member", async () => {
        const subject = await build()

        expect(Object.keys(subject.bankFactsOfCredit({ bankRef: "FT1" }))).toEqual(["bankRef"])
        expect(Object.keys(subject.bankFactsOfCredit({}))).toEqual([])
    })
})
