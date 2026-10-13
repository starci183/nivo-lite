import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { OrdersReadService } from "./orders-read.service"
import { OrdersService } from "./orders.service"
import type { SalesOrderListRow, SalesOrderRow } from "./persistence/orders.rows"

const MEMBER: WorkspaceMember = {
    userId: "user-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "An",
    status: "active",
}

const ORDER: SalesOrderRow = {
    id: "order-1",
    workspace_id: "ws-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    order_no: "EXT-1",
    items: "tea",
    amount_vnd: 1000,
    status: "draft",
    origin: "live",
    confirmed_by: null,
    confirmed_at: null,
    created_at: "2026-10-13T03:00:00.000Z",
    shipped_at: null,
    carrier: null,
    tracking_code: null,
}

const LISTED: SalesOrderListRow = { ...ORDER, contact_name: null, company: null }

const VIEW = {
    id: "order-1",
    workspaceId: "ws-1",
    leadId: "lead-1",
    orderNo: "EXT-1",
    items: "tea",
    amountVnd: 1000,
    status: "draft",
    origin: "live",
    confirmedBy: null,
    confirmedAt: null,
    createdAt: "2026-10-13T03:00:00.000Z",
    shippedAt: null,
    carrier: null,
    trackingCode: null,
}

const build = async () => {
    const members = mock<WorkspaceMembersService>()
    const orders = mock<OrdersService>()
    members.require.mockResolvedValue(MEMBER)
    const moduleRef = await Test.createTestingModule({
        providers: [
            OrdersReadService,
            { provide: WorkspaceMembersService, useValue: members },
            { provide: OrdersService, useValue: orders },
        ],
    }).compile()
    return { service: moduleRef.get(OrdersReadService), members, orders }
}

describe("OrdersReadService", () => {
    it("proves membership and returns the order view", async () => {
        const { service, members, orders } = await build()
        orders.find.mockResolvedValue(ORDER)

        await expect(service.find("user-1", "ws-1", "order-1")).resolves.toEqual(VIEW)
        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
    })

    it("returns null when the order is missing", async () => {
        const { service, orders } = await build()
        orders.find.mockResolvedValue(null)

        await expect(service.find("user-1", "ws-1", "missing")).resolves.toBeNull()
    })

    it("lists the newest orders as views", async () => {
        const { service, orders } = await build()
        orders.list.mockResolvedValue([LISTED])

        await expect(service.list("user-1", "ws-1")).resolves.toEqual([VIEW])
        expect(orders.list).toHaveBeenCalledWith("ws-1")
    })
})
