import { Test } from "@nestjs/testing"
import { builder, FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In, IsNull, Like, Not } from "typeorm"
import { answerQueryBuilders, fakeQueryBuilder } from "@tests/fixtures/builders/fake-query-builder.builder"
import { MINH, orderEntityOf, orderOf, writtenOf } from "@tests/fixtures/builders/orders.builder"
import { LeadReadService } from "@modules/domain/leads"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { normalizePage } from "@modules/platform/pagination"
import { OrdersErrorCode } from "./errors/orders.error"
import type { NewOrderDraft, OrderConfirmation, OrdersWorkbenchRow, SalesOrderListRow } from "./orders.contracts"
import { OrdersService } from "./orders.service"
import { OrderEntity } from "./persistence/entities"

const NOW = "2026-10-13T02:00:00.000Z"

const draftOf = builder<NewOrderDraft>({
    workspaceId: "ws-1",
    leadId: "lead-1",
    inboundEventId: "event-1",
    orderNo: null,
    items: "2 x Tea",
    amountVnd: 90000,
})

const confirmationOf = builder<OrderConfirmation>({
    workspaceId: "ws-1",
    orderId: "order-1",
    amountVnd: 90000,
    items: "2 x Tea",
    confirmedBy: "Lan",
})

const build = async (entityManager: MockEntityManager, cards: ReadonlyArray<typeof MINH> = [MINH]) => {
    const leads = mock<LeadReadService>({ cardsOf: jest.fn(() => Promise.resolve([...cards])) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            OrdersService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LeadReadService, useValue: leads },
        ],
    }).compile()
    return Object.assign(moduleRef.get(OrdersService), { doubles: { leads } })
}

/** Makes the successive query builders of `em` each answer a write with the given `RETURNING` rows. */
const answerWrites = (em: MockEntityManager, ...answers: Array<ReadonlyArray<unknown>>) => {
    const builders = answers.map((raw) => fakeQueryBuilder({ execute: { raw } }))
    answerQueryBuilders(em, ...builders)
    return builders
}

/** A fresh entity manager answering writes like {@link answerWrites}. */
const writing = (...answers: Array<ReadonlyArray<unknown>>) => {
    const em = mockEntityManager()
    return { em, builders: answerWrites(em, ...answers) }
}

const registerListPage = () => {
    const workspaceId = "11111111-1111-4111-8111-111111111111"
    const newestId = "33333333-3333-4333-8333-333333333333"
    const olderId = "22222222-2222-4222-8222-222222222222"
    const createdAt = "2026-10-13T01:00:00.000123+00:00"
    const scope = `salesOrders:${workspaceId}`

    describe("listPage", () => {
        it("reads one extra row and resumes after the complete creation/id position", async () => {
            const newest = orderOf({ id: newestId, workspace_id: workspaceId, created_at: createdAt })
            const older = orderOf({ id: olderId, workspace_id: workspaceId, created_at: createdAt })
            const em = mockEntityManager()
            const firstPage = fakeQueryBuilder({ getRawMany: [newest, older] })
            const secondPage = fakeQueryBuilder({ getRawMany: [older] })
            answerQueryBuilders(em, firstPage, secondPage)
            const orders = await build(em)

            const first = await orders.listPage(workspaceId, { first: 1 })

            expect(first.nodes).toEqual([newest])
            expect(first.pageInfo.hasNextPage).toBe(true)
            expect(normalizePage({ after: first.pageInfo.endCursor }, scope).after).toEqual({
                createdAt,
                id: newestId,
            })

            const second = await orders.listPage(workspaceId, { first: 1, after: first.pageInfo.endCursor })

            expect(second.nodes).toEqual([older])
            expect(second.pageInfo.hasNextPage).toBe(false)
            expect(firstPage.argsOf("limit")).toEqual([[2]])
            expect(firstPage.argsOf("andWhere")).toEqual([])
            expect(secondPage.argsOf("andWhere")).toEqual([
                [
                    "(o.created_at, o.id) < (:cursorAt::timestamptz, :cursorId::uuid)",
                    { cursorAt: createdAt, cursorId: newestId },
                ],
            ])
            expect(secondPage.argsOf("orderBy")).toEqual([["o.createdAt", "DESC"]])
            expect(secondPage.argsOf("addOrderBy")).toEqual([["o.id", "DESC"]])
        })

        it("uses a bounded default page and answers no cursor for an empty workspace", async () => {
            const em = mockEntityManager()
            const page = fakeQueryBuilder({ getRawMany: [] })
            answerQueryBuilders(em, page)
            const orders = await build(em)

            await expect(orders.listPage(workspaceId)).resolves.toEqual({
                nodes: [],
                pageInfo: { endCursor: null, hasNextPage: false },
            })
            expect(page.argsOf("limit")).toEqual([[51]])
        })

        it("rejects a malformed cursor before reading any orders", async () => {
            const em = mockEntityManager()
            const orders = await build(em)

            await expect(orders.listPage(workspaceId, { after: "not-a-cursor" })).rejects.toBeDefined()
            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        })

        it("rejects a cursor from a different workspace before querying it", async () => {
            const em = mockEntityManager()
            const page = fakeQueryBuilder({ getRawMany: [orderOf({ id: newestId, created_at: createdAt })] })
            answerQueryBuilders(em, page)
            const orders = await build(em)
            const other = "44444444-4444-4444-8444-444444444444"
            const first = await orders.listPage(other, { first: 1 })

            await expect(orders.listPage(workspaceId, { after: first.pageInfo.endCursor })).rejects.toBeDefined()
            expect(em.createQueryBuilder).toHaveBeenCalledTimes(1)
        })
    })
}

const registerReads = () => {
    describe("find", () => {
        it("answers the order of the workspace", async () => {
            const em = mockEntityManager({ findOne: [OrderEntity, orderEntityOf(orderOf())] })
            const orders = await build(em)

            await expect(orders.find("ws-1", "order-1")).resolves.toEqual(orderOf())
            expect(em.findOne).toHaveBeenCalledWith(OrderEntity, { where: { workspaceId: "ws-1", id: "order-1" } })
        })

        it("answers null for an order the workspace does not have", async () => {
            const orders = await build(mockEntityManager({ findOne: [OrderEntity, null] }))

            await expect(orders.find("ws-1", "missing")).resolves.toBeNull()
        })
    })

    describe("exists", () => {
        it("asks whether the workspace has the order", async () => {
            const em = mockEntityManager({ exists: [OrderEntity, true] })

            await expect((await build(em)).exists("ws-1", "order-1")).resolves.toBe(true)
            expect(em.exists).toHaveBeenCalledWith(OrderEntity, { where: { workspaceId: "ws-1", id: "order-1" } })
        })
    })
}

const registerListReads = () => {
    describe("list", () => {
        it("caps a large page at 500 orders and names the customers from the leads owner", async () => {
            const row: SalesOrderListRow = { ...orderOf(), contact_name: "Minh", company: "Tea Co" }
            const em = mockEntityManager({ find: [OrderEntity, [orderEntityOf(orderOf())]] })
            const orders = await build(em)

            await expect(orders.list("ws-1", 9999)).resolves.toEqual([row])
            expect(em.find).toHaveBeenCalledWith(OrderEntity, {
                where: { workspaceId: "ws-1" },
                order: { createdAt: "DESC" },
                take: 500,
            })
            expect(orders.doubles.leads.cardsOf).toHaveBeenCalledWith("ws-1", ["lead-1"])
        })

        it("leaves the customer unnamed for an order without one or whose lead is gone", async () => {
            const em = mockEntityManager({
                find: [
                    OrderEntity,
                    [
                        orderEntityOf(orderOf({ id: "o-1", lead_id: null })),
                        orderEntityOf(orderOf({ id: "o-2", lead_id: "gone" })),
                    ],
                ],
            })
            const orders = await build(em, [])

            await expect(orders.list("ws-1")).resolves.toEqual([
                expect.objectContaining({ id: "o-1", contact_name: null, company: null }),
                expect.objectContaining({ id: "o-2", contact_name: null, company: null }),
            ])
            expect(orders.doubles.leads.cardsOf).toHaveBeenCalledWith("ws-1", ["gone"])
        })

        it("reads at least one order and 200 by default", async () => {
            const em = mockEntityManager({ find: [OrderEntity, []] })
            const orders = await build(em)

            await orders.list("ws-1", 0)
            await orders.list("ws-1")

            expect(em.find).toHaveBeenNthCalledWith(1, OrderEntity, expect.objectContaining({ take: 1 }))
            expect(em.find).toHaveBeenNthCalledWith(2, OrderEntity, expect.objectContaining({ take: 200 }))
        })
    })

    describe("recentRefs", () => {
        it("reads the newest orders of any status as number and customer, bounded", async () => {
            const em = mockEntityManager({ find: [OrderEntity, [orderEntityOf(orderOf())]] })

            await expect((await build(em)).recentRefs("ws-1", 300)).resolves.toEqual([
                { id: "order-1", orderNo: "DH-20261013-0001", leadId: "lead-1" },
            ])
            expect(em.find).toHaveBeenCalledWith(OrderEntity, {
                select: { id: true, orderNo: true, leadId: true },
                where: { workspaceId: "ws-1" },
                order: { createdAt: "DESC", id: "DESC" },
                take: 300,
            })
        })
    })
}

const registerWorkbenchReads = () => {
    describe("listForWorkbench", () => {
        it("reads the workbench orders with a clamped limit", async () => {
            const row: OrdersWorkbenchRow = orderOf({ status: "confirmed" })
            const em = mockEntityManager({
                find: [
                    [OrderEntity, [orderEntityOf(row)]],
                    [OrderEntity, []],
                ],
            })
            const orders = await build(em)

            await expect(orders.listForWorkbench("ws-1")).resolves.toEqual([row])
            await expect(orders.listForWorkbench("ws-1", -3)).resolves.toEqual([])
            expect(em.find).toHaveBeenNthCalledWith(1, OrderEntity, {
                where: { workspaceId: "ws-1", status: Not("draft") },
                order: { createdAt: "DESC", id: "DESC" },
                take: 200,
            })
            expect(em.find).toHaveBeenNthCalledWith(2, OrderEntity, expect.objectContaining({ take: 1 }))
        })
    })

    describe("listForLead", () => {
        it("reads the orders of one customer", async () => {
            const em = mockEntityManager({ find: [OrderEntity, [orderEntityOf(orderOf())]] })
            const orders = await build(em)

            await expect(orders.listForLead("ws-1", "lead-1")).resolves.toEqual([orderOf()])
            expect(em.find).toHaveBeenCalledWith(OrderEntity, {
                where: { workspaceId: "ws-1", leadId: "lead-1" },
                order: { createdAt: "DESC", id: "DESC" },
                take: 500,
            })
        })
    })
}

const registerShipAndLabels = () => {
    describe("ship", () => {
        it("records the shipment at the clock instant on the manager it is given", async () => {
            const shipped = orderOf({ status: "confirmed", shipped_at: NOW, carrier: "GHN", tracking_code: "T1" })
            const own = mockEntityManager()
            const { em: tx, builders } = writing([writtenOf(shipped)])
            const [update] = builders
            const orders = await build(own)

            await expect(orders.ship("ws-1", "order-1", "GHN", "T1", tx)).resolves.toEqual(shipped)
            expect(update?.argsOf("set")).toEqual([[{ carrier: "GHN", trackingCode: "T1", shippedAt: new Date(NOW) }]])
            expect(update?.argsOf("where")).toEqual([
                [
                    {
                        workspaceId: "ws-1",
                        id: "order-1",
                        status: In(["confirmed", "invoiced", "paid"]),
                        shippedAt: IsNull(),
                    },
                ],
            ])
            expect(own.createQueryBuilder).not.toHaveBeenCalled()
        })

        it("keeps an order with no amount unpriced when it ships", async () => {
            const shipped = orderOf({ status: "confirmed", amount_vnd: null, shipped_at: NOW, carrier: "GHN" })
            const { em: tx } = writing([writtenOf(shipped)])
            const orders = await build(mockEntityManager())

            await expect(orders.ship("ws-1", "order-1", "GHN", "T1", tx)).resolves.toEqual(shipped)
        })

        it("answers null when the order cannot be shipped", async () => {
            const orders = await build(writing([]).em)

            await expect(orders.ship("ws-1", "order-1", "GHN", "T1")).resolves.toBeNull()
        })
    })

    describe("labelsOf", () => {
        it("reads nothing for no orders", async () => {
            const em = mockEntityManager()
            const orders = await build(em)

            await expect(orders.labelsOf("ws-1", [])).resolves.toEqual([])
            expect(em.find).not.toHaveBeenCalled()
        })

        it("reads the number and items of the given orders", async () => {
            const em = mockEntityManager({ find: [OrderEntity, [orderEntityOf(orderOf())]] })
            const orders = await build(em)

            await expect(orders.labelsOf("ws-1", ["order-1"])).resolves.toEqual([
                { id: "order-1", order_no: "DH-20261013-0001", items: "2 x Tea" },
            ])
            expect(em.find).toHaveBeenCalledWith(OrderEntity, {
                select: { id: true, orderNo: true, items: true },
                where: { workspaceId: "ws-1", id: In(["order-1"]) },
                take: 200,
            })
        })
    })
}

const registerDraft = () => {
    describe("draft", () => {
        it("numbers the order after the ones already taken today in shop time", async () => {
            const drafted = orderOf({ order_no: "DH-20261013-0004" })
            const em = mockEntityManager({ count: [OrderEntity, 3] })
            const insert = fakeQueryBuilder({ execute: { raw: [writtenOf(drafted)] } })
            answerQueryBuilders(em, insert)
            const orders = await build(em)

            await expect(orders.draft(draftOf())).resolves.toEqual(drafted)
            expect(em.count).toHaveBeenCalledWith(OrderEntity, {
                where: { workspaceId: "ws-1", orderNo: Like("DH-20261013-%") },
            })
            expect(insert.argsOf("values")).toEqual([
                [
                    {
                        workspaceId: "ws-1",
                        leadId: "lead-1",
                        inboundEventId: "event-1",
                        orderNo: "DH-20261013-0004",
                        items: "2 x Tea",
                        amountVnd: 90000,
                        status: "draft",
                    },
                ],
            ])
            expect(insert.argsOf("orIgnore")).toHaveLength(1)
        })

        it("starts the day at the first number when no order is numbered yet", async () => {
            const em = mockEntityManager({ count: [OrderEntity, 0] })
            const [insert] = answerWrites(em, [writtenOf(orderOf())])
            const orders = await build(em)

            await orders.draft(draftOf())

            expect(insert?.argsOf("values")[0]?.[0]).toMatchObject({ orderNo: "DH-20261013-0001" })
        })

        it("keeps the channel number and suffixes it when it is taken", async () => {
            const drafted = orderOf({ order_no: "SHOP-77-11" })
            const em = mockEntityManager()
            const [taken, free] = answerWrites(em, [], [writtenOf(drafted)])
            const orders = await build(em)

            await expect(orders.draft(draftOf({ orderNo: "SHOP-77" }))).resolves.toEqual(drafted)
            expect(taken?.argsOf("values")[0]?.[0]).toMatchObject({ orderNo: "SHOP-77" })
            expect(free?.argsOf("values")[0]?.[0]).toMatchObject({ orderNo: "SHOP-77-11" })
        })

        it("gives up after five taken numbers", async () => {
            const { em } = writing([])
            const orders = await build(em)

            await expect(orders.draft(draftOf({ orderNo: "SHOP-77" }))).rejects.toMatchObject({
                code: OrdersErrorCode.NotNumbered,
            })
            expect(em.createQueryBuilder).toHaveBeenCalledTimes(5)
        })
    })
}

const registerTransitions = () => {
    describe("confirm", () => {
        it("confirms the draft at the clock instant", async () => {
            const confirmed = orderOf({ status: "confirmed", confirmed_by: "Lan", confirmed_at: NOW })
            const em = mockEntityManager()
            const update = fakeQueryBuilder({ execute: { raw: [writtenOf(confirmed)] } })
            answerQueryBuilders(em, update)
            const orders = await build(em)

            await expect(orders.confirm(confirmationOf())).resolves.toEqual(confirmed)
            expect(update.argsOf("set")).toEqual([
                [
                    {
                        status: "confirmed",
                        amountVnd: 90000,
                        items: "2 x Tea",
                        confirmedBy: "Lan",
                        confirmedAt: new Date(NOW),
                    },
                ],
            ])
            expect(update.argsOf("where")).toEqual([[{ workspaceId: "ws-1", id: "order-1", status: "draft" }]])
        })

        it("answers null for an order that is no longer a draft", async () => {
            const orders = await build(writing([]).em)

            await expect(orders.confirm(confirmationOf({ amountVnd: null }))).resolves.toBeNull()
        })
    })
}

const registerSettlement = () => {
    describe("cancel", () => {
        it("answers the cancelled draft, or null once it is gone", async () => {
            const cancelled = orderOf({ status: "cancelled" })
            const orders = await build(writing([writtenOf(cancelled)], []).em)

            await expect(orders.cancel("ws-1", "order-1")).resolves.toEqual(cancelled)
            await expect(orders.cancel("ws-1", "order-1")).resolves.toBeNull()
        })
    })

    describe("markInvoiced and markPaid", () => {
        it("moves the order to invoiced and then paid", async () => {
            const em = mockEntityManager({ update: [OrderEntity, { affected: 1 }] })
            const orders = await build(em)

            await orders.markInvoiced("ws-1", "order-1")
            await orders.markPaid("ws-1", "order-1")

            const where = { workspaceId: "ws-1", id: "order-1", status: Not("cancelled") }
            expect(em.update).toHaveBeenNthCalledWith(1, OrderEntity, where, { status: "invoiced" })
            expect(em.update).toHaveBeenNthCalledWith(2, OrderEntity, where, { status: "paid" })
        })

        it("marks the order paid through the manager of the caller's transaction", async () => {
            const own = mockEntityManager()
            const callers = mockEntityManager({ update: [OrderEntity, { affected: 1 }] })
            const orders = await build(own)

            await orders.markPaid("ws-1", "order-1", callers)

            expect(callers.update).toHaveBeenCalledWith(
                OrderEntity,
                { workspaceId: "ws-1", id: "order-1", status: Not("cancelled") },
                { status: "paid" },
            )
            expect(own.update).not.toHaveBeenCalled()
        })
    })
}

describe("OrdersService", () => {
    registerReads()
    registerListReads()
    registerWorkbenchReads()
    registerListPage()
    registerShipAndLabels()
    registerDraft()
    registerTransitions()
    registerSettlement()
})
