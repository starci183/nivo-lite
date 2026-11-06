import { decideByCode, scoreCandidates } from "@nivo-lite/agent-sdk/reconcile"
import { orderOf, transactionOf } from "./accounting.fixtures"
import {
    ambiguousSource,
    amountText,
    arrivalOf,
    candidateOf,
    questionText,
    rematchOf,
    sinceOf,
    wrongAmountSource,
} from "./rematch"
import {
    CODE_ISSUED_AT,
    CONTENT_BY_LOCALE,
    CREDIT_BEFORE_CODE,
    CREDIT_NO_CODE,
    CREDIT_PARTIAL,
    REMATCH_ORDER,
} from "./rematch.fixtures"

describe("sinceOf", () => {
    it("counts the days back from the instant the code was issued", () => {
        expect(sinceOf(CODE_ISSUED_AT, 7)).toBe("2026-10-30T09:00:00.000Z")
        expect(sinceOf(CODE_ISSUED_AT, 1)).toBe("2026-11-05T09:00:00.000Z")
    })
})

describe("candidateOf", () => {
    it("makes the order a candidate whose code is its number and whose amount due is its amount", () => {
        expect(candidateOf(REMATCH_ORDER)).toMatchObject({
            id: REMATCH_ORDER.id,
            amountDue: 5_000,
            codes: ["DH-20261106-0001"],
        })
    })

    it("is none for an order that no longer waits for money or has no amount yet", () => {
        expect(candidateOf(orderOf({ status: "paid" }))).toBeNull()
        expect(candidateOf(orderOf({ status: "draft" }))).toBeNull()
        expect(candidateOf(orderOf({ amountVnd: null }))).toBeNull()
        expect(candidateOf(orderOf({ status: "invoiced" }))).not.toBeNull()
    })
})

describe("arrivalOf", () => {
    it("reads a credit as the arrival path does: the amount, the transfer content and the name the bank gave", () => {
        expect(arrivalOf(CREDIT_BEFORE_CODE)).toEqual({
            id: CREDIT_BEFORE_CODE.id,
            amount: 5_000,
            text: CONTENT_BY_LOCALE.vi,
            names: ["NGUYEN VAN DINH"],
            at: Date.parse("2026-11-05T14:00:00.000Z"),
        })
    })

    it("has no name and no text for a credit that carries none", () => {
        expect(arrivalOf(transactionOf({ payer: null, reference: null }))).toMatchObject({ names: [], text: "" })
    })
})

describe("rematchOf", () => {
    it("settles the credit that arrived before the code, whatever language the content is written in", () => {
        for (const reference of Object.values(CONTENT_BY_LOCALE)) {
            const credit = transactionOf({ ...CREDIT_BEFORE_CODE, reference })
            expect(rematchOf(REMATCH_ORDER, [credit])).toEqual({ settle: credit, wrongAmount: [], ambiguous: [] })
        }
    })

    it("judges a credit exactly as the arrival path does when it arrives after the code", () => {
        const candidate = candidateOf(REMATCH_ORDER)
        const arrival = arrivalOf(CREDIT_BEFORE_CODE)
        const arrived =
            candidate === null ? null : decideByCode(scoreCandidates(arrival, [candidate], [], { windowMs: 1 }))
        expect(arrived?.effect).toEqual({ kind: "apply", candidateId: REMATCH_ORDER.id })
        expect(rematchOf(REMATCH_ORDER, [CREDIT_BEFORE_CODE]).settle).toBe(CREDIT_BEFORE_CODE)
    })

    it("leaves a credit that names the code with another amount to the owner and settles nothing", () => {
        expect(rematchOf(REMATCH_ORDER, [CREDIT_PARTIAL])).toEqual({
            settle: null,
            wrongAmount: [CREDIT_PARTIAL],
            ambiguous: [],
        })
    })

    it("settles the right credit and still reports a partial one beside it", () => {
        expect(rematchOf(REMATCH_ORDER, [CREDIT_PARTIAL, CREDIT_BEFORE_CODE])).toEqual({
            settle: CREDIT_BEFORE_CODE,
            wrongAmount: [CREDIT_PARTIAL],
            ambiguous: [],
        })
    })

    it("settles none when two credits name the code with the amount due", () => {
        const twin = transactionOf({ ...CREDIT_BEFORE_CODE, id: "00000000-0000-4000-8000-000000095999" })
        expect(rematchOf(REMATCH_ORDER, [CREDIT_BEFORE_CODE, twin])).toEqual({
            settle: null,
            wrongAmount: [],
            ambiguous: [CREDIT_BEFORE_CODE, twin],
        })
    })

    it("ignores a credit that names no code, money out and a credit that is already matched", () => {
        const matched = transactionOf({ ...CREDIT_BEFORE_CODE, status: "matched", orderId: "x" })
        const out = transactionOf({ ...CREDIT_BEFORE_CODE, direction: "debit" })
        const review = transactionOf({ ...CREDIT_BEFORE_CODE, status: "needs_review" })
        expect(rematchOf(REMATCH_ORDER, [CREDIT_NO_CODE, matched, out, review])).toEqual({
            settle: null,
            wrongAmount: [],
            ambiguous: [],
        })
    })

    it("does nothing for an order that no longer waits for money", () => {
        expect(rematchOf(orderOf({ ...REMATCH_ORDER, status: "paid" }), [CREDIT_BEFORE_CODE])).toEqual({
            settle: null,
            wrongAmount: [],
            ambiguous: [],
        })
    })
})

describe("the words of the questions", () => {
    it("fills a template and writes an amount with the thousands separated", () => {
        expect(questionText("{count} x {name}", { count: 2, name: "DH" })).toBe("2 x DH")
        expect(amountText(5_000)).toBe("5.000")
    })

    it("names the source a question is asked once under", () => {
        expect(wrongAmountSource("t1")).toBe("rematch:amount:t1")
        expect(ambiguousSource("o1")).toBe("rematch:many:o1")
    })
})
