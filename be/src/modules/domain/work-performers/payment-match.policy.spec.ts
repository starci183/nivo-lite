import { Test } from "@nestjs/testing"
import type { ProposalCandidate } from "@modules/domain/work-items"
import type { MatchableInvoice } from "./payment-match.policy"
import { mentionsCode, bankNameOf, matchPayment, claimKeyOf, candidateOf } from "./payment-match.policy"

const SUBJECT = Symbol("payment-match.policy")
type Subject = {
    mentionsCode: typeof mentionsCode
    bankNameOf: typeof bankNameOf
    matchPayment: typeof matchPayment
    claimKeyOf: typeof claimKeyOf
    candidateOf: typeof candidateOf
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    mentionsCode,
                    bankNameOf,
                    matchPayment,
                    claimKeyOf,
                    candidateOf,
                },
            },
        ],
    }).compile()
    const subject = moduleRef.get<Subject>(SUBJECT)
    return { subject }
}

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
    it("matches a code after banks drop its separators", async () => {
        const { subject } = await buildSubject()

        expect(subject.mentionsCode("pay INV20261 thanks", "INV-2026-1")).toBe(true)
    })

    it("matches a later copy when an earlier number only starts with the code", async () => {
        const { subject } = await buildSubject()

        expect(subject.mentionsCode("INV202611 then INV20261", "inv-2026-1")).toBe(true)
    })

    it("rejects a longer number that only starts with the code", async () => {
        const { subject } = await buildSubject()

        expect(subject.mentionsCode("INV202611", "INV-2026-1")).toBe(false)
    })

    it("matches a code that ends the transfer text", async () => {
        const { subject } = await buildSubject()

        expect(subject.mentionsCode("REF INV20261", "INV-2026-1")).toBe(true)
    })

    it("rejects a code that is not in the text", async () => {
        const { subject } = await buildSubject()

        expect(subject.mentionsCode("rent", "INV-2026-1")).toBe(false)
    })

    it("rejects an empty code", async () => {
        const { subject } = await buildSubject()

        expect(subject.mentionsCode("INV20261", "")).toBe(false)
        expect(subject.mentionsCode("INV20261", "---")).toBe(false)
        expect(subject.mentionsCode("INV20261", null)).toBe(false)
        expect(subject.mentionsCode("INV20261", undefined)).toBe(false)
    })

    it("reads a missing transfer text as empty", async () => {
        const { subject } = await buildSubject()

        expect(subject.mentionsCode(null, "INV-1")).toBe(false)
        expect(subject.mentionsCode(undefined, "INV-1")).toBe(false)
    })
})

describe("bankNameOf", () => {
    it.each([
        ["sepay:evt-1", "SePay"],
        ["casso:evt-1", "Casso"],
        ["payos:evt-1", "payOS"],
    ])("names %s as %s", async (eventId, bank) => {
        const { subject } = await buildSubject()

        expect(subject.bankNameOf("bank", eventId)).toBe(bank)
    })

    it("names a bank event whose id has no colon", async () => {
        const { subject } = await buildSubject()

        expect(subject.bankNameOf("bank", "sepay")).toBe("SePay")
    })

    it("answers nothing for a provider that is not a known bank", async () => {
        const { subject } = await buildSubject()

        expect(subject.bankNameOf("bank", "other:evt-1")).toBeNull()
    })

    it("answers nothing for an empty provider, with or without an event suffix", async () => {
        const { subject } = await buildSubject()

        expect(subject.bankNameOf("bank", "")).toBeNull()
        expect(subject.bankNameOf("bank", ":evt-1")).toBeNull()
    })

    it("answers nothing when the channel is not a bank feed", async () => {
        const { subject } = await buildSubject()

        expect(subject.bankNameOf("zalo", "sepay:evt-1")).toBeNull()
    })

    it("answers nothing when a bank event has no id", async () => {
        const { subject } = await buildSubject()

        expect(subject.bankNameOf("bank", null)).toBeNull()
    })
})

describe("matchPayment", () => {
    const named = invoiceOf({ id: "inv-named", invoiceNo: "INV-2026-1", orderNo: "ORD-9", amountVnd: 1000 })
    const sameAmount = invoiceOf({ id: "inv-amount", invoiceNo: "INV-2", orderNo: "ORD-2", amountVnd: 1000 })
    const other = invoiceOf({ id: "inv-other", invoiceNo: "INV-3", orderNo: null, amountVnd: 50 })

    it("is clear when the content names one invoice of the same amount", async () => {
        const { subject } = await buildSubject()

        expect(subject.matchPayment([other, named, sameAmount], "INV20261", 1000)).toEqual({
            pool: [named],
            clear: true,
        })
    })

    it("offers every named invoice, and is not clear, when the content names more than one", async () => {
        const { subject } = await buildSubject()

        const second = invoiceOf({ id: "inv-ord", invoiceNo: "INV-8", orderNo: "ORD-9", amountVnd: 1000 })

        expect(subject.matchPayment([named, second], "ORD9", 1000)).toEqual({
            pool: [named, second],
            clear: false,
        })
    })

    it("offers the named invoice, and is not clear, when the amount differs", async () => {
        const { subject } = await buildSubject()

        expect(subject.matchPayment([named], "INV20261", 50)).toEqual({ pool: [named], clear: false })
    })

    it("offers the invoices of the same amount when the content names none", async () => {
        const { subject } = await buildSubject()

        expect(subject.matchPayment([named, sameAmount, other], "rent", 1000)).toEqual({
            pool: [named, sameAmount],
            clear: false,
        })
    })

    it("offers the newest five when nothing matches the content or the amount", async () => {
        const { subject } = await buildSubject()

        const issued = [0, 1, 2, 3, 4, 5].map((n) =>
            invoiceOf({ id: `inv-${n}`, invoiceNo: `INV-${n}`, orderNo: `ORD-${n}`, amountVnd: n + 10 }),
        )

        expect(subject.matchPayment(issued, "rent", null)).toEqual({ pool: issued.slice(0, 5), clear: false })
    })

    it("offers nothing when there is no issued invoice", async () => {
        const { subject } = await buildSubject()

        expect(subject.matchPayment([], "rent", 1000)).toEqual({ pool: [], clear: false })
    })
})

describe("claimKeyOf", () => {
    it("keys the paid-claim check of one invoice", async () => {
        const { subject } = await buildSubject()

        expect(subject.claimKeyOf("inv-1")).toBe("reconcile_payment:invoice:inv-1")
    })
})

describe("candidateOf", () => {
    it("carries the invoice as a proposal candidate", async () => {
        const { subject } = await buildSubject()

        const invoice = invoiceOf({ id: "inv-1", amountVnd: 2500 })
        const candidate: ProposalCandidate = { id: "inv-1", label: "INV-2026-1 · 2.500", amount_vnd: 2500 }

        expect(subject.candidateOf(invoice, "INV-2026-1 · 2.500")).toEqual(candidate)
    })
})
