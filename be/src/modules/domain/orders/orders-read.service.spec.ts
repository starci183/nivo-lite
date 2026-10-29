import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { OrdersReadService } from "./orders-read.service"
import { OrdersService } from "./orders.service"
import type { SalesOrderListRow } from "./orders.contracts"

const orderOf = builder<SalesOrderListRow>({
    id: "order-1",
    workspace_id: "ws-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    order_no: "DH-20261013-0001",
    items: "2 x Tea",
    amount_vnd: 90000,
    status: "shipped",
    confirmed_by: "Lan",
    confirmed_at: "2026-10-13T01:30:00.000Z",
    created_at: "2026-10-13T01:00:00.000Z",
    shipped_at: "2026-10-13T03:00:00.000Z",
    carrier: "GHN",
    tracking_code: "T1",
    contact_name: "Minh",
    company: null,
})

const VIEW = {
    id: "order-1",
    workspaceId: "ws-1",
    leadId: "lead-1",
    orderNo: "DH-20261013-0001",
    items: "2 x Tea",
    amountVnd: 90000,
    status: "shipped",
    confirmedBy: "Lan",
    confirmedAt: "2026-10-13T01:30:00.000Z",
    createdAt: "2026-10-13T01:00:00.000Z",
    shippedAt: "2026-10-13T03:00:00.000Z",
    carrier: "GHN",
    trackingCode: "T1",
}

const build = async () => {
    const members = mock<WorkspaceMembersService>()
    const orders = mock<OrdersService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            OrdersReadService,
            { provide: WorkspaceMembersService, useValue: members },
            { provide: OrdersService, useValue: orders },
        ],
    }).compile()
    return { reads: moduleRef.get(OrdersReadService), members, orders }
}

describe("OrdersReadService", () => {
    describe("find", () => {
        it("proves membership and answers the order view", async () => {
            const { reads, members, orders } = await build()
            orders.find.mockResolvedValue(orderOf())

            await expect(reads.find("user-1", "ws-1", "order-1")).resolves.toEqual(VIEW)
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(orders.find).toHaveBeenCalledWith("ws-1", "order-1")
        })

        it("answers null for an order the workspace does not have", async () => {
            const { reads, orders } = await build()
            orders.find.mockResolvedValue(null)

            await expect(reads.find("user-1", "ws-1", "missing")).resolves.toBeNull()
        })

        it("reads nothing when membership is refused", async () => {
            const { reads, members, orders } = await build()
            const refusal = "not a member"
            members.require.mockRejectedValue(refusal)

            await expect(reads.find("user-1", "ws-1", "order-1")).rejects.toBe(refusal)
            expect(orders.find).not.toHaveBeenCalled()
        })
    })

    describe("list", () => {
        it("maps the newest orders to views, keeping open dates null", async () => {
            const { reads, members, orders } = await build()
            const pageInfo = { endCursor: "opaque-order-cursor", hasNextPage: true }
            const request = { first: 2, after: "preceding-order-cursor" }
            orders.listPage.mockResolvedValue({
                nodes: [
                    orderOf(),
                    orderOf({
                        id: "order-2",
                        confirmed_at: null,
                        shipped_at: null,
                        carrier: null,
                        tracking_code: null,
                    }),
                ],
                pageInfo,
            })

            await expect(reads.list("user-1", "ws-1", request)).resolves.toEqual({
                nodes: [
                    VIEW,
                    { ...VIEW, id: "order-2", confirmedAt: null, shippedAt: null, carrier: null, trackingCode: null },
                ],
                pageInfo,
            })
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(orders.listPage).toHaveBeenCalledWith("ws-1", request)
        })

        it("answers an empty default page with the persistence page information", async () => {
            const { reads, orders } = await build()
            const page = { nodes: [], pageInfo: { endCursor: null, hasNextPage: false } }
            orders.listPage.mockResolvedValue(page)

            await expect(reads.list("user-1", "ws-1")).resolves.toEqual(page)
            expect(orders.listPage).toHaveBeenCalledWith("ws-1", {})
        })

        it("reads no page when workspace membership is refused", async () => {
            const { reads, members, orders } = await build()
            const refusal = "not a member"
            members.require.mockRejectedValue(refusal)

            await expect(reads.list("user-1", "ws-1")).rejects.toBe(refusal)
            expect(orders.listPage).not.toHaveBeenCalled()
        })
    })
})
