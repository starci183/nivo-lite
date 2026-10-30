import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { orderShippedAt } from "@tests/fixtures/builders/sales-status.builder"
import { DecisionsErrorCode } from "@modules/domain/decisions"
import { OrdersService } from "@modules/domain/orders"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { SalesActionRow } from "./persistence/sales.rows"
import { SalesStatusService } from "./sales-status.service"

const SALES_ACTION_FIND = 'SELECT * FROM "public"."sales_action_find"($1, $2, $3)'

const actionOf = builder<SalesActionRow>({
    id: "msg-1",
    state: "queued",
    work_item_id: "item-1",
    work_status: null,
    target_found: true,
})

const build = async (entityManager: MockEntityManager) => {
    const members = mock<WorkspaceMembersService>()
    const orders = mock<OrdersService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SalesStatusService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: OrdersService, useValue: orders },
        ],
    }).compile()
    return { statuses: moduleRef.get(SalesStatusService), members, orders }
}

describe("SalesStatusService > status", () => {
    it("proves membership and reports a queued action as it stands", async () => {
        const em = mockEntityManager({ query: [SALES_ACTION_FIND, [actionOf()]] })
        const { statuses, members } = await build(em)

        await expect(statuses.status("user-1", "ws-1", "msg-1")).resolves.toEqual({
            id: "msg-1",
            status: "queued",
            workItemId: "item-1",
            errorCode: null,
        })
        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
        expect(em.query).toHaveBeenCalledWith(SALES_ACTION_FIND, ["ws-1", null, "msg-1"])
    })

    it("reports a finished action whose work went on as succeeded", async () => {
        const em = mockEntityManager({
            query: [SALES_ACTION_FIND, [actionOf({ state: "done", work_status: "done" })]],
        })
        const { statuses } = await build(em)

        await expect(statuses.status("user-1", "ws-1", "msg-1")).resolves.toEqual({
            id: "msg-1",
            status: "succeeded",
            workItemId: "item-1",
            errorCode: null,
        })
    })

    it.each([
        ["the job failed", actionOf({ state: "failed" })],
        ["the target is gone", actionOf({ state: "running", target_found: false })],
        ["the work failed after the job", actionOf({ state: "done", work_status: "failed" })],
        ["the work is still queued after the job", actionOf({ state: "done", work_status: "queued" })],
    ])("reports a failure with its code when %s", async (_name, row) => {
        const { statuses } = await build(mockEntityManager({ query: [SALES_ACTION_FIND, [row]] }))

        await expect(statuses.status("user-1", "ws-1", "msg-1")).resolves.toEqual({
            id: "msg-1",
            status: "failed",
            workItemId: "item-1",
            errorCode: DecisionsErrorCode.WorkFailed,
        })
    })

    it("reports a shipment, which the order id names, as succeeded once the order is shipped", async () => {
        const { statuses, orders } = await build(mockEntityManager({ query: [SALES_ACTION_FIND, []] }))
        orders.find.mockResolvedValue(orderShippedAt("2026-10-13T03:00:00.000Z"))

        await expect(statuses.status("user-1", "ws-1", "order-1")).resolves.toEqual({
            id: "order-1",
            status: "succeeded",
            workItemId: null,
            errorCode: null,
        })
        expect(orders.find).toHaveBeenCalledWith("ws-1", "order-1")
    })

    it("refuses an order that is not shipped as a shipment", async () => {
        const { statuses, orders } = await build(mockEntityManager({ query: [SALES_ACTION_FIND, []] }))
        orders.find.mockResolvedValue(orderShippedAt(null))

        await expect(statuses.status("user-1", "ws-1", "order-1")).rejects.toMatchObject({
            code: DecisionsErrorCode.NotFound,
        })
    })

    it("refuses an action the workspace does not have", async () => {
        const { statuses } = await build(mockEntityManager({ query: [SALES_ACTION_FIND, []] }))

        await expect(statuses.status("user-1", "ws-1", "missing")).rejects.toMatchObject({
            code: DecisionsErrorCode.NotFound,
        })
    })
})

describe("SalesStatusService > queued", () => {
    it("reads the action by its dedupe key on the transaction it is given", async () => {
        const own = mockEntityManager()
        const tx = mockEntityManager({ query: [SALES_ACTION_FIND, [actionOf({ work_item_id: null })]] })
        const { statuses } = await build(own)

        await expect(statuses.queued(tx, "ws-1", "order.shipped:order-1")).resolves.toEqual({
            id: "msg-1",
            status: "queued",
            workItemId: null,
            errorCode: null,
        })
        expect(tx.query).toHaveBeenCalledWith(SALES_ACTION_FIND, ["ws-1", "order.shipped:order-1", null])
        expect(own.query).not.toHaveBeenCalled()
    })

    it("refuses a key with no action behind it", async () => {
        const { statuses } = await build(mockEntityManager())

        await expect(
            statuses.queued(mockEntityManager({ query: [SALES_ACTION_FIND, []] }), "ws-1", "missing"),
        ).rejects.toMatchObject({ code: DecisionsErrorCode.NotFound })
    })
})
