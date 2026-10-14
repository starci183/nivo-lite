import type { ProposalCandidate } from "@modules/domain/work-items"
import type { MatchableInvoice } from "./payment-match.policy"
import { bankNameOf, candidateOf, claimKeyOf, matchPayment, mentionsCode } from "./payment-match.policy"

const invoiceOf = (overrides: Partial<MatchableInvoice>): MatchableInvoice => ({
    id: "inv-1",
    invoiceNo: "INV-2026-1",
    orderNo: "ORD-9",
    leadId: "lead-1",
    name: "Lan",
    amountVnd: 1000,
    ...overrides,
})

describe("mentionsCode", () => {
    it("matches a code after banks drop its separators", () => {
        expect(mentionsCode("pay INV20261 thanks", "INV-2026-1")).toBe(true)
    })

    it("matches a later copy when an earlier number only starts with the code", () => {
        expect(mentionsCode("INV202611 then INV20261", "inv-2026-1")).toBe(true)
    })

    it("rejects a longer number that only starts with the code", () => {
        expect(mentionsCode("INV202611", "INV-2026-1")).toBe(false)
    })

    it("matches a code that ends the transfer text", () => {
        expect(mentionsCode("REF INV20261", "INV-2026-1")).toBe(true)
    })

    it("rejects a code that is not in the text", () => {
        expect(mentionsCode("rent", "INV-2026-1")).toBe(false)
    })

    it("rejects an empty code", () => {
        expect(mentionsCode("INV20261", "")).toBe(false)
        expect(mentionsCode("INV20261", "---")).toBe(false)
        expect(mentionsCode("INV20261", null)).toBe(false)
        expect(mentionsCode("INV20261", undefined)).toBe(false)
    })

    it("reads a missing transfer text as empty", () => {
        expect(mentionsCode(null, "INV-1")).toBe(false)
        expect(mentionsCode(undefined, "INV-1")).toBe(false)
    })
})

describe("bankNameOf", () => {
    it.each([
        ["vietcombank:evt-1", "Vietcombank"],
        ["sepay:evt-1", "SePay"],
        ["casso:evt-1", "Casso"],
        ["payos:evt-1", "payOS"],
    ])("names %s as %s", (eventId, bank) => {
        expect(bankNameOf("bank", eventId)).toBe(bank)
    })

    it("names a bank event whose id has no colon", () => {
        expect(bankNameOf("bank", "vietcombank")).toBe("Vietcombank")
    })

    it("answers nothing for a provider that is not a known bank", () => {
        expect(bankNameOf("bank", "other:evt-1")).toBeNull()
    })

    it("answers nothing for an empty provider, with or without an event suffix", () => {
        expect(bankNameOf("bank", "")).toBeNull()
        expect(bankNameOf("bank", ":evt-1")).toBeNull()
    })

    it("answers nothing when the channel is not a bank feed", () => {
        expect(bankNameOf("zalo", "vietcombank:evt-1")).toBeNull()
    })

    it("answers nothing when a bank event has no id", () => {
        expect(bankNameOf("bank", null)).toBeNull()
    })
})

describe("matchPayment", () => {
    const named = invoiceOf({ id: "inv-named", invoiceNo: "INV-2026-1", orderNo: "ORD-9", amountVnd: 1000 })
    const sameAmount = invoiceOf({ id: "inv-amount", invoiceNo: "INV-2", orderNo: "ORD-2", amountVnd: 1000 })
    const other = invoiceOf({ id: "inv-other", invoiceNo: "INV-3", orderNo: null, amountVnd: 50 })

    it("is clear when the content names one invoice of the same amount", () => {
        expect(matchPayment([other, named, sameAmount], "INV20261", 1000)).toEqual({
            pool: [named],
            clear: true,
        })
    })

    it("offers every named invoice, and is not clear, when the content names more than one", () => {
        const second = invoiceOf({ id: "inv-ord", invoiceNo: "INV-8", orderNo: "ORD-9", amountVnd: 1000 })

        expect(matchPayment([named, second], "ORD9", 1000)).toEqual({
            pool: [named, second],
            clear: false,
        })
    })

    it("offers the named invoice, and is not clear, when the amount differs", () => {
        expect(matchPayment([named], "INV20261", 50)).toEqual({ pool: [named], clear: false })
    })

    it("offers the invoices of the same amount when the content names none", () => {
        expect(matchPayment([named, sameAmount, other], "rent", 1000)).toEqual({
            pool: [named, sameAmount],
            clear: false,
        })
    })

    it("offers the newest five when nothing matches the content or the amount", () => {
        const issued = [0, 1, 2, 3, 4, 5].map((n) =>
            invoiceOf({ id: `inv-${n}`, invoiceNo: `INV-${n}`, orderNo: `ORD-${n}`, amountVnd: n + 10 }),
        )

        expect(matchPayment(issued, "rent", null)).toEqual({ pool: issued.slice(0, 5), clear: false })
    })

    it("offers nothing when there is no issued invoice", () => {
        expect(matchPayment([], "rent", 1000)).toEqual({ pool: [], clear: false })
    })
})

describe("claimKeyOf", () => {
    it("keys the paid-claim check of one invoice", () => {
        expect(claimKeyOf("inv-1")).toBe("reconcile_payment:invoice:inv-1")
    })
})

describe("candidateOf", () => {
    it("carries the invoice as a proposal candidate", () => {
        const invoice = invoiceOf({ id: "inv-1", amountVnd: 2500 })
        const candidate: ProposalCandidate = { id: "inv-1", label: "INV-2026-1 · 2.500", amount_vnd: 2500 }

        expect(candidateOf(invoice, "INV-2026-1 · 2.500")).toEqual(candidate)
    })
})
