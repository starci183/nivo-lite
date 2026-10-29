import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { toSalesOrderView } from "./orders-view.mapper"
import type { SalesOrderRow } from "./orders.contracts"

const SUBJECT = Symbol("orders-view.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toSalesOrderView } }],
    }).compile()
    return moduleRef.get<typeof import("./orders-view.mapper")>(SUBJECT)
}

const orderOf = builder<SalesOrderRow>({
    id: "order-1",
    workspace_id: "workspace-1",
    lead_id: "lead-1",
    inbound_event_id: "event-1",
    order_no: "DH-0001",
    items: "2 x Tea",
    amount_vnd: 90000,
    status: "confirmed",
    confirmed_by: "Lan",
    confirmed_at: "2026-10-13T01:30:00+07:00",
    created_at: "2026-10-13T01:00:00+07:00",
    shipped_at: "2026-10-13T03:00:00+07:00",
    carrier: "GHN",
    tracking_code: "tracking-1",
})

const VIEW = {
    id: "order-1",
    workspaceId: "workspace-1",
    leadId: "lead-1",
    orderNo: "DH-0001",
    items: "2 x Tea",
    amountVnd: 90000,
    status: "confirmed",
    confirmedBy: "Lan",
    confirmedAt: "2026-10-13T01:30:00+07:00",
    createdAt: "2026-10-13T01:00:00+07:00",
    shippedAt: "2026-10-13T03:00:00+07:00",
    carrier: "GHN",
    trackingCode: "tracking-1",
}

describe("toSalesOrderView", () => {
    it("maps every public order field and retains stored string instants", async () => {
        const subject = await buildSubject()

        expect(subject.toSalesOrderView(orderOf())).toEqual(VIEW)
    })

    it("keeps absent customer, money, confirmation and shipment fields null", async () => {
        const subject = await buildSubject()

        const row = orderOf({
            lead_id: null,
            amount_vnd: null,
            confirmed_by: null,
            confirmed_at: null,
            shipped_at: null,
            carrier: null,
            tracking_code: null,
        })

        expect(subject.toSalesOrderView(row)).toEqual({
            ...VIEW,
            leadId: null,
            amountVnd: null,
            confirmedBy: null,
            confirmedAt: null,
            shippedAt: null,
            carrier: null,
            trackingCode: null,
        })
    })

    it("normalizes Date instants returned by a database driver to UTC ISO strings", async () => {
        const subject = await buildSubject()

        const row = orderOf()
        Reflect.set(row, "created_at", new Date("2026-10-13T01:00:00+07:00"))
        Reflect.set(row, "confirmed_at", new Date("2026-10-13T01:30:00+07:00"))
        Reflect.set(row, "shipped_at", new Date("2026-10-13T03:00:00+07:00"))

        expect(subject.toSalesOrderView(row)).toEqual({
            ...VIEW,
            createdAt: "2026-10-12T18:00:00.000Z",
            confirmedAt: "2026-10-12T18:30:00.000Z",
            shippedAt: "2026-10-12T20:00:00.000Z",
        })
    })
})
