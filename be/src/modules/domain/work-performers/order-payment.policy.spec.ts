import type { Brief } from "@nivo-lite/agent-sdk/reconcile"
import { eventOf } from "@tests/fixtures/builders/reconcile-payment-performer.builder"
import {
    JUDGEMENT_SCHEMA,
    JUDGE_SYSTEM_PROMPT,
    arrivalOf,
    candidatesOf,
    claimAmountOf,
    claimNamesOf,
    claimOf,
    judgeBriefOf,
    judgementOf,
} from "./order-payment.policy"

const NOW = Date.parse("2026-11-04T01:06:00.000Z")

const order = (over: Record<string, unknown> = {}) => ({
    id: "order-1",
    workspace_id: "ws-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    order_no: "SO-0001",
    items: "1 chau hoa",
    amount_vnd: 5000,
    status: "confirmed",
    confirmed_by: "Lan",
    confirmed_at: "2026-11-04T00:30:00.000Z",
    created_at: "2026-11-04T00:20:00.000Z",
    shipped_at: null,
    carrier: null,
    tracking_code: null,
    contact_name: "Bùi Nguyên Định",
    company: null,
    ...over,
})

describe("claimAmountOf", () => {
    it.each([
        ["Tôi đã chuyển khoản 5k, tên BUI NGUYEN DINH", 5000],
        ["đã ck 5.000đ", 5000],
        ["gửi 20000 vnd rồi", 20000],
        ["chuyển 1,5 triệu", 1_500_000],
        ["chuyển 2tr", 2_000_000],
        ["chuyển 150 nghìn", 150_000],
    ])("reads %s as %d", (text, amount) => {
        expect(claimAmountOf(text)).toBe(amount)
    })

    it("names no amount for a quantity or no number", () => {
        expect(claimAmountOf("mua 2 chậu hoa, mã 7o940")).toBeNull()
        expect(claimAmountOf("mình đã chuyển rồi nhé")).toBeNull()
    })
})

describe("claimNamesOf", () => {
    it("reads the account holder after the word for name", () => {
        expect(claimNamesOf("Tôi đã chuyển khoản 5k, tên BUI NGUYEN DINH")).toEqual(["BUI NGUYEN DINH"])
        expect(claimNamesOf("chủ tài khoản: Nguyen Van A")).toEqual(["Nguyen Van A"])
    })

    it("answers none when no name was given", () => {
        expect(claimNamesOf("đã chuyển rồi")).toEqual([])
    })
})

describe("candidatesOf", () => {
    const since = NOW - 72 * 3_600_000

    it("keeps the orders that wait for money, with an amount, opened inside the window", () => {
        const kept = candidatesOf(
            [
                order(),
                order({ id: "paid", status: "paid" }),
                order({ id: "draft", status: "draft" }),
                order({ id: "no-amount", amount_vnd: null }),
                order({ id: "old", confirmed_at: "2026-10-01T00:00:00.000Z" }),
                order({ id: "unconfirmed", confirmed_at: null, created_at: "2026-11-04T00:00:00.000Z" }),
            ],
            since,
            (one) => `label ${one.order_no}`,
        )
        expect(kept.map((one) => one.id)).toEqual(["order-1", "unconfirmed"])
        expect(kept[0]).toEqual({
            id: "order-1",
            label: "label SO-0001",
            amountDue: 5000,
            partyName: "Bùi Nguyên Định",
            partyKey: "lead-1",
            codes: ["SO-0001"],
            openedAt: Date.parse("2026-11-04T00:30:00.000Z"),
        })
    })
})

describe("arrivalOf and claimOf", () => {
    it("takes the transfer content and the body as the words, and the sender as a name", () => {
        const arrival = arrivalOf(
            eventOf({ external_ref: "BUI NGUYEN DINH Test", body: "SePay +5000", sender_name: "Dinh" }),
            5000,
            NOW,
        )
        expect(arrival).toEqual({
            id: "ev-1",
            amount: 5000,
            text: "BUI NGUYEN DINH Test SePay +5000",
            names: ["Dinh"],
            at: NOW,
        })
        expect(arrivalOf(eventOf({ external_ref: null, body: "x" }), 1, NOW)).toMatchObject({ text: "x", names: [] })
    })

    it("reads a stored claim as the ledger does", () => {
        const claimedAt = new Date(NOW)
        expect(
            claimOf({
                id: "k1",
                workspaceId: "ws-1",
                leadId: "lead-1",
                conversationId: null,
                amountVnd: 5000,
                names: ["BUI NGUYEN DINH"],
                body: "5k",
                claimedAt,
                status: "open",
            }),
        ).toEqual({
            id: "k1",
            partyKey: "lead-1",
            amount: 5000,
            names: ["BUI NGUYEN DINH"],
            text: "5k",
            at: NOW,
            status: "open",
        })
    })
})

describe("the judge's brief and answer", () => {
    it("states the transfer, the orders with their evidence and the claims as JSON", () => {
        const brief: Brief = {
            arrival: { id: "a", amount: 5000, text: "content", names: ["n"], at: NOW },
            candidates: [
                {
                    candidate: {
                        id: "order-1",
                        label: "SO-0001",
                        amountDue: 5000,
                        partyName: "Dinh",
                        partyKey: "lead-1",
                        codes: [],
                        openedAt: NOW,
                    },
                    evidence: [{ key: "amount", met: true, detail: "5000 against 5000 due" }],
                    score: 40,
                },
            ],
            claims: [{ id: "k", partyKey: "lead-1", amount: 5000, names: [], text: "5k", at: NOW, status: "open" }],
        }
        const parsed = JSON.parse(judgeBriefOf(brief))
        expect(parsed.transfer).toMatchObject({ amount: 5000, content: "content" })
        expect(parsed.orders[0]).toMatchObject({ id: "order-1", evidence: [{ check: "amount", holds: true }] })
        expect(parsed.customer_claims[0]).toMatchObject({ customer: "lead-1", said: "5k" })
        expect(JUDGE_SYSTEM_PROMPT).toContain("match")
    })

    it("reads the schema's answer as a judgement and refuses a verdict it does not know", () => {
        const answer = JUDGEMENT_SCHEMA.parse({ verdict: "match", candidate_id: "order-1", reasons: ["ok"] })
        expect(judgementOf(answer)).toEqual({ verdict: "match", candidateId: "order-1", reasons: ["ok"] })
        expect(JUDGEMENT_SCHEMA.safeParse({ verdict: "maybe", candidate_id: null, reasons: [] }).success).toBe(false)
    })
})
