import { createHash } from "node:crypto"
import { Test } from "@nestjs/testing"
import type { InvoiceRow } from "@modules/domain/invoices"
import { turnOf } from "@tests/fixtures/builders/customer-outcomes.builder"
import type { CapturedOrder, CustomerReply } from "./customer-turns.contracts"
import { REPLY_ACTION, evidenceOfTurn, replyCheckOf } from "./reply-graph.policy"
import type { Judged } from "./reply-graph.policy"

/** The members of the subject under test. */
interface Subject {
    readonly evidenceOfTurn: typeof evidenceOfTurn
    readonly replyCheckOf: typeof replyCheckOf
}

const SUBJECT = Symbol("reply-graph.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { evidenceOfTurn, replyCheckOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const REPLY: CustomerReply = {
    reply: "Thanks!",
    needsHuman: false,
    reason: null,
    proposedAnswer: null,
    lead: null,
    order: null,
    paymentClaim: false,
    knowledgeGap: null,
    application: null,
    loyaltyRewardKey: null,
    bookingRequest: null,
}

const ORDER: CapturedOrder = { items: "Tra sua", amountVnd: 50_000 }

const invoiceOf = (amount: number): InvoiceRow => ({
    id: "inv-1",
    workspace_id: "ws-1",
    order_id: "o1",
    lead_id: "l1",
    invoice_no: "HD-01",
    amount_vnd: amount,
    status: "issued",
    issued_by: null,
    paid_at: null,
    contract_id: null,
    period_ends_on: null,
})

const JUDGED: Judged = { reply: "Thanks!", needsHuman: false, reason: null, order: null, claimOpen: null }

describe("reply-graph.policy evidenceOfTurn", () => {
    it("reads a turn about no money as no evidence, which reads 0 and does not wait", async () => {
        const subject = await build()

        expect(subject.evidenceOfTurn(REPLY, JUDGED, null)).toEqual([])
    })

    it("reads an order as a claim on the order record, with the amount of the record", async () => {
        const subject = await build()

        expect(subject.evidenceOfTurn({ ...REPLY, order: ORDER }, JUDGED, 50_000)).toEqual([
            { key: "amount_vnd", value: 50_000, kind: "claimed", via: "order_record" },
        ])
    })

    it("keeps an order whose record has no amount as an entry with no value, so the turn waits", async () => {
        const subject = await build()

        expect(subject.evidenceOfTurn({ ...REPLY, order: ORDER }, JUDGED, null)).toEqual([
            { key: "amount_vnd", value: null, kind: "claimed", via: "order_record" },
        ])
    })

    it("reads a payment claim as a claim made in the chat, for the amount of the open invoice", async () => {
        const subject = await build()
        const judged = { ...JUDGED, claimOpen: invoiceOf(70_000) }

        expect(subject.evidenceOfTurn({ ...REPLY, paymentClaim: true }, judged, null)).toEqual([
            { key: "amount_vnd", value: 70_000, kind: "claimed", via: "chat_text" },
        ])
    })

    it("keeps a payment claim that matched no invoice as an entry with no value, so the turn waits", async () => {
        const subject = await build()

        expect(subject.evidenceOfTurn({ ...REPLY, paymentClaim: true }, JUDGED, null)).toEqual([
            { key: "amount_vnd", value: null, kind: "claimed", via: "chat_text" },
        ])
    })

    it("reads an invoice the books hold as paid as money received, and lists it after the claims", async () => {
        const subject = await build()
        const judged = { ...JUDGED, claimOpen: invoiceOf(70_000), paid: invoiceOf(90_000) }

        expect(subject.evidenceOfTurn({ ...REPLY, paymentClaim: true, order: ORDER }, judged, 50_000)).toEqual([
            { key: "amount_vnd", value: 50_000, kind: "claimed", via: "order_record" },
            { key: "amount_vnd", value: 70_000, kind: "claimed", via: "chat_text" },
            { key: "amount_vnd", value: 90_000, kind: "received", via: "invoice_paid" },
        ])
    })
})

describe("reply-graph.policy replyCheckOf", () => {
    const SCOPE = { key: "m1", leadId: "lead-1", evidence: [] }

    it("checks the text that really leaves on the reply road, keyed on the message and the digest of the text", async () => {
        const subject = await build()
        const turn = { ...turnOf("l1"), origin: { turnId: "turn-1", wakeId: "wake-1" } }

        expect(subject.replyCheckOf(turn, "Hello", SCOPE)).toEqual({
            workspaceId: "11111111-1111-4111-8111-111111111111",
            installationId: null,
            action: REPLY_ACTION,
            road: "reply",
            key: `m1:${createHash("sha256").update("Hello").digest("hex")}`,
            subjectType: "conversation",
            subjectId: "c1",
            leadId: "lead-1",
            text: "Hello",
            evidence: SCOPE.evidence,
            attributes: {},
            turnId: "turn-1",
            wakeId: "wake-1",
            askOpensWork: true,
        })
    })

    it("keys a different draft for the same message apart, and names no turn on the legacy road", async () => {
        const subject = await build()

        const first = subject.replyCheckOf(turnOf(), "Hello", SCOPE)
        const second = subject.replyCheckOf(turnOf(), "Hello again", SCOPE)

        expect(first.key).not.toBe(second.key)
        expect(first).toMatchObject({ turnId: null, wakeId: null })
    })
})
