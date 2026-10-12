import type { AcceptedCommand } from "@modules/domain/decisions"
import type { ProposedCommand } from "@modules/integrations/deepseek"
import { DomainError } from "@modules/platform/errors"
import type { MessageRefs, ReadyResolution } from "./office.contracts"
import {
    acceptsText,
    cardRowsOf,
    failureDetail,
    fold,
    matchLeads,
    matchOrders,
    mentionedHandles,
    needTextOf,
    resolveCandidate,
    subjectRowOf,
} from "./office-command.policy"

class SampleError extends DomainError<"SAMPLE"> {}

const accepted = (overrides: Partial<AcceptedCommand>): AcceptedCommand => ({
    command: "issue_receipt",
    action: "issue_receipt",
    subjectType: "order",
    requiredFields: [],
    description: { vi: "xuat phieu thu", en: "issue a receipt" },
    ...overrides,
})

const choice = (overrides: Partial<ProposedCommand>): ProposedCommand => ({
    intent: "command",
    command: "issue_receipt",
    subject_id: null,
    lead_id: null,
    fields: {},
    ...overrides,
})

/** Vietnamese letters the fold must strip, written by code point because the source stays ASCII. */
const E_CIRCUMFLEX_TILDE = String.fromCodePoint(0x1ec5)
const I_DOT = String.fromCodePoint(0x1ecb)
const D_STROKE = String.fromCodePoint(0x110)
const O_TILDE = String.fromCodePoint(0x1ed7)
const lan = { id: "l-1", name: `Nguy${E_CIRCUMFLEX_TILDE}n Th${I_DOT}` + " Lan", company: "ACME" }
const minh = { id: "l-2", name: "Minh", company: null }
const order1 = { id: "o-1", orderNo: "DH-1", leadId: "l-1" }
const order2 = { id: "o-2", orderNo: "#DH-2", leadId: null }
const none: MessageRefs = { leads: [], orders: [] }

describe("office command policy", () => {
    describe("mentionedHandles", () => {
        it("lists the handles in order without repeats", () => {
            expect(mentionedHandles("@ke-toan xuat phieu @sales va @ke-toan")).toEqual(["ke-toan", "sales"])
            expect(mentionedHandles("no mention")).toEqual([])
        })
    })

    describe("fold", () => {
        it("lowers case and drops accents", () => {
            expect(fold(`${D_STROKE}${O_TILDE} Th${I_DOT} LAN`)).toBe("do thi lan")
        })
    })

    describe("matchOrders", () => {
        it("finds orders by number however it is written", () => {
            const orders = [order1, order2, { id: "o-3", orderNo: "", leadId: null }]
            expect(matchOrders("xuat phieu thu cho don #dh-1", orders)).toEqual([order1])
            expect(matchOrders("don DH2 va dh1", orders)).toEqual([order1, order2])
            expect(matchOrders("khong co ma", orders)).toEqual([])
        })
    })

    describe("matchLeads", () => {
        const leads = [lan, minh, { id: "l-3", name: "Lan", company: null }, { id: "l-4", name: "", company: "Vu" }]

        it("prefers the full name over the given name (a lead named exactly Lan is a full match too)", () => {
            expect(matchLeads("goi cho nguyen thi lan nhe", leads)).toEqual([lan, leads[2]])
        })

        it("falls back to the company, then to the given name", () => {
            expect(matchLeads("bao gia cho acme", leads)).toEqual([lan])
            expect(matchLeads("goi anh minh", leads)).toEqual([minh])
        })

        it("returns every lead of the strongest tier and ignores short names and mentions", () => {
            expect(matchLeads("goi lan", leads)).toEqual([leads[2]])
            const same = [lan, { id: "l-5", name: "Tran Lan", company: null }]
            expect(matchLeads("goi lan", same).map((lead) => lead.id)).toEqual(["l-1", "l-5"])
            expect(matchLeads("@lan vu", leads)).toEqual([])
            expect(matchLeads("hello", leads)).toEqual([])
        })
    })

    describe("acceptsText", () => {
        it("joins the descriptions in the language", () => {
            const list = [accepted({}), accepted({ description: { vi: "doi soat", en: "reconcile" } })]
            expect(acceptsText("vi", list)).toBe("xuat phieu thu; doi soat")
            expect(acceptsText("en", list)).toBe("issue a receipt; reconcile")
        })
    })

    describe("resolveCandidate", () => {
        it("is unmapped for no command or one the agent does not accept", () => {
            expect(resolveCandidate(choice({ command: null }), [accepted({})], none)).toEqual({ kind: "unmapped" })
            expect(resolveCandidate(choice({ command: "other" }), [accepted({})], none)).toEqual({ kind: "unmapped" })
        })

        it("addresses an order by the id the model gave and carries its customer", () => {
            const refs = { leads: [lan], orders: [order1, order2] }
            const result = resolveCandidate(choice({ subject_id: "o-1" }), [accepted({})], refs)
            expect(result).toEqual({
                kind: "ok",
                command: "issue_receipt",
                description: { vi: "xuat phieu thu", en: "issue a receipt" },
                payload: { subject_type: "order", subject_id: "o-1", lead_id: "l-1" },
                leadId: "l-1",
                orderId: "o-1",
                extra: {},
            })
        })

        it("uses the single named order when the model left the id out, and omits a missing customer", () => {
            const refs = { leads: [], orders: [order2] }
            expect(resolveCandidate(choice({}), [accepted({})], refs)).toMatchObject({
                payload: { subject_type: "order", subject_id: "o-2" },
                leadId: null,
                orderId: "o-2",
            })
        })

        it("drops an order id that was not offered", () => {
            const refs = { leads: [], orders: [order1, order2] }
            expect(resolveCandidate(choice({ subject_id: "o-9" }), [accepted({})], refs)).toMatchObject({
                payload: { subject_type: "order" },
                orderId: null,
            })
        })

        it("addresses a customer by id, by the only named customer or by the only named order", () => {
            const lead = accepted({ subjectType: "lead", requiredFields: ["lead_id"] })
            const byId = resolveCandidate(choice({ lead_id: "l-2" }), [lead], { leads: [lan, minh], orders: [] })
            expect(byId).toMatchObject({ payload: { subject_id: "l-2", lead_id: "l-2" }, leadId: "l-2" })
            const sole = resolveCandidate(choice({}), [lead], { leads: [lan], orders: [] })
            expect(sole).toMatchObject({ leadId: "l-1" })
            const viaOrder = resolveCandidate(choice({}), [lead], { leads: [], orders: [order1] })
            expect(viaOrder).toMatchObject({ leadId: "l-1", orderId: null })
        })

        it("asks for the customer when none is named", () => {
            const lead = accepted({ subjectType: "lead", requiredFields: ["lead_id"] })
            expect(resolveCandidate(choice({}), [lead], { leads: [lan, minh], orders: [] })).toMatchObject({
                kind: "missing",
                command: "issue_receipt",
                subjectType: "lead",
                missing: ["lead_id"],
            })
        })

        it("reads other required keys from the model's fields and reports the absent ones", () => {
            const invoice = accepted({ subjectType: "invoice", requiredFields: ["subject_id", "amount", "note"] })
            const result = resolveCandidate(choice({ fields: { amount: 5 } }), [invoice], none)
            expect(result).toMatchObject({ kind: "missing", missing: ["subject_id", "note"] })
            const ready = resolveCandidate(
                choice({ fields: { amount: 5, note: "x" }, subject_id: "i-1" }),
                [accepted({ subjectType: "stock", requiredFields: ["amount", "note"] })],
                none,
            )
            expect(ready).toMatchObject({
                kind: "ok",
                payload: { subject_type: "stock", amount: 5, note: "x" },
                extra: { amount: 5, note: "x" },
                leadId: null,
                orderId: null,
            })
        })
    })

    describe("needTextOf", () => {
        it("words each missing key", () => {
            expect(needTextOf("lead_id", "order")).toEqual({ key: "office.cmdNeedLead", field: "lead_id" })
            expect(needTextOf("amount", "order")).toEqual({ key: "office.cmdNeedOther", field: "amount" })
            expect(needTextOf("subject_id", "order")).toEqual({ key: "office.cmdNeedOrder", field: "order" })
            expect(needTextOf("subject_id", "lead")).toEqual({ key: "office.cmdNeedLead", field: "lead" })
            expect(needTextOf("subject_id", "invoice")).toEqual({ key: "office.cmdNeedInvoice", field: "invoice" })
            expect(needTextOf("subject_id", "stock")).toEqual({ key: "office.cmdNeedOther", field: "stock" })
        })
    })

    describe("cardRowsOf and subjectRowOf", () => {
        const labels = { customer: "Customer", order: "Order" }
        const ready = (overrides: Partial<ReadyResolution>): ReadyResolution => ({
            kind: "ok",
            command: "c",
            description: { vi: "v", en: "e" },
            payload: {},
            leadId: null,
            orderId: null,
            extra: {},
            ...overrides,
        })

        it("lists the customer, the order and the other keys", () => {
            const refs = { leads: [lan], orders: [order1, order2] }
            const rows = cardRowsOf(
                ready({ leadId: "l-1", orderId: "o-1", extra: { amount: 5 } }),
                refs,
                new Map([["l-1", "Lan"]]),
                labels,
            )
            expect(rows).toEqual([
                { key: "customer", label: "Customer", value: "Lan" },
                { key: "order", label: "Order", value: "#DH-1" },
                { key: "amount", label: "amount", value: "5" },
            ])
            expect(subjectRowOf(rows)).toEqual({ key: "order", label: "Order", value: "#DH-1" })
        })

        it("keeps a number that already starts with a hash, falls back to the id for an unknown customer name", () => {
            const refs = { leads: [], orders: [order2] }
            const rows = cardRowsOf(ready({ leadId: "l-9", orderId: "o-2" }), refs, new Map(), labels)
            expect(rows).toEqual([
                { key: "customer", label: "Customer", value: "l-9" },
                { key: "order", label: "Order", value: "#DH-2" },
            ])
            expect(subjectRowOf(rows.slice(0, 1))).toEqual({ key: "customer", label: "Customer", value: "l-9" })
        })

        it("has no rows and no subject without references", () => {
            expect(cardRowsOf(ready({}), none, new Map(), labels)).toEqual([])
            expect(subjectRowOf([])).toBeUndefined()
        })
    })

    describe("failureDetail", () => {
        it("reads the refusal detail of a domain error, else its code, else the text of the failure", () => {
            expect(failureDetail(new SampleError({ code: "SAMPLE", params: { detail: "limit" } }))).toBe("limit")
            expect(failureDetail(new SampleError({ code: "SAMPLE", params: { detail: 3 } }))).toBe("SAMPLE")
            expect(failureDetail(new TypeError("boom"))).toBe("boom")
            expect(failureDetail("plain")).toBe("plain")
        })
    })
})
