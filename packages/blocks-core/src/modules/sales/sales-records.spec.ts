import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { leadNameOf, leadRowOf, leadRowsOf, orderBriefOf, orderRowOf } from "./sales-records"

const record = (data: Readonly<Record<string, unknown>>): RecordRow => ({
    id: "r1",
    workspaceId: "w1",
    version: "3",
    createdAt: "2026-11-01T08:00:00.000Z",
    updatedAt: "2026-11-02T08:00:00.000Z",
    data,
})

const LEAD = { contactName: "Lan", channel: "zalo", stage: "new" }

const ORDER = {
    orderNo: "DH-20261104-0001",
    items: { lines: [{ name: "tr\u00e0", qty: 2, unitVnd: 10_000, amountVnd: 20_000 }] },
    itemsText: "2 x tea",
    note: "",
    status: "draft",
}

describe("leadRowOf", () => {
    it("reads a lead with its system fields and reads a key the engine left out as null", () => {
        expect(leadRowOf(record({ ...LEAD, phone: "84901", company: null }))).toEqual({
            id: "r1",
            version: "3",
            createdAt: "2026-11-01T08:00:00.000Z",
            updatedAt: "2026-11-02T08:00:00.000Z",
            contactId: null,
            contactName: "Lan",
            company: null,
            channel: "zalo",
            need: null,
            stage: "new",
            phone: "84901",
            email: null,
            contextSummary: null,
            closedReason: null,
            awaitingSince: null,
            owner: null,
            nextStep: null,
            nextDueAt: null,
            quoteVnd: null,
            orderVnd: null,
            note: null,
            needs: null,
        })
    })

    it("reads the fields of the pipeline a lead holds", () => {
        expect(
            leadRowOf(
                record({
                    ...LEAD,
                    owner: "Minh",
                    nextStep: "Send quote",
                    nextDueAt: "2026-11-06T09:00:00.000Z",
                    quoteVnd: 12_500_000,
                    awaitingSince: "2026-11-05T07:00:00.000Z",
                }),
            ),
        ).toMatchObject({
            owner: "Minh",
            nextStep: "Send quote",
            nextDueAt: "2026-11-06T09:00:00.000Z",
            quoteVnd: 12_500_000,
            awaitingSince: "2026-11-05T07:00:00.000Z",
        })
    })

    it("leaves out of a page the rows that are no lead's", () => {
        const rows = leadRowsOf([{ row: record({ ...LEAD }) }, { row: record({}) }])
        expect(rows.map((lead) => lead.contactName)).toEqual(["Lan"])
    })

    it("is null for fields that are no lead's", () => {
        expect(leadRowOf(record({ ...LEAD, stage: "contacted" }))).toBeNull()
        expect(leadRowOf(record({}))).toBeNull()
    })
})

describe("orderRowOf", () => {
    it("reads an order with the shipment it has", () => {
        expect(orderRowOf(record({ ...ORDER, contactId: "c1", amountVnd: 120_000, carrier: "GHN" }))).toMatchObject({
            id: "r1",
            version: "3",
            orderNo: "DH-20261104-0001",
            contactId: "c1",
            amountVnd: 120_000,
            status: "draft",
            carrier: "GHN",
            trackingCode: null,
            shippedAt: null,
        })
    })

    it("reads an order with no customer and no total yet", () => {
        expect(orderRowOf(record(ORDER))).toMatchObject({ contactId: null, amountVnd: null, confirmedBy: null })
    })

    it("is null for fields that are no order's", () => {
        expect(orderRowOf(record({ ...ORDER, status: "lost" }))).toBeNull()
        expect(orderRowOf(record({ ...ORDER, amountVnd: -1 }))).toBeNull()
    })
})

describe("orderBriefOf", () => {
    it("reads what a customer's detail adds up, with the creation time of the record", () => {
        expect(orderBriefOf(record({ orderNo: "DH-1", status: "paid", amountVnd: 5 }))).toEqual({
            orderNo: "DH-1",
            status: "paid",
            amountVnd: 5,
            createdAt: "2026-11-01T08:00:00.000Z",
        })
    })

    it("is null for fields that are no order's", () => {
        expect(orderBriefOf(record({ status: "paid" }))).toBeNull()
    })
})

describe("leadNameOf", () => {
    it("reads the name of a customer", () => {
        expect(leadNameOf({ contactName: "Lan" })).toBe("Lan")
        expect(leadNameOf({})).toBeNull()
    })
})
