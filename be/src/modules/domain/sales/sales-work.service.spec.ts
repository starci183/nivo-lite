import { Test } from "@nestjs/testing"
import { builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { DecisionsErrorCode, DecisionsService, EvidenceService, WorkEngineService } from "@modules/domain/decisions"
import type { WorkItem } from "@modules/domain/decisions"
import { InvoicesService } from "@modules/domain/invoices"
import type { InvoiceRow } from "@modules/domain/invoices"
import { OrdersErrorCode, OrdersService } from "@modules/domain/orders"
import type { OptionalOrder } from "@modules/domain/orders"
import { WorkItemsService } from "@modules/domain/work-items"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { DecisionsQueue } from "@modules/queues/decisions"
import { SalesStatusService } from "./sales-status.service"
import { SalesWorkService } from "./sales-work.service"
import type { SalesAction, SalesItemRequest } from "./sales.contracts"

const UPDATED_AT = "2026-10-13T01:00:00.000Z"

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "send_quote",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    inbound_event_id: "in-1",
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "failed",
    decided_path: null,
    reason: "over_authority",
    reasons: [],
    missing_fields: [],
    proposal: { summary: "S", fields: {} },
    result: null,
    error: "boom",
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "live",
    created_at: "2026-10-12T10:00:00.000Z",
    updated_at: UPDATED_AT,
    completed_at: null,
    installation_id: "inst-1",
})

const memberOf = builder<WorkspaceMember>({
    userId: "user-1",
    workspaceId: "ws-1",
    role: "manager",
    staffId: null,
    displayName: "Lan",
    status: "active",
})

const orderOf = builder<NonNullable<OptionalOrder>>({
    id: "order-1",
    workspace_id: "ws-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    order_no: "DH-20261013-0001",
    items: "2 x Tea",
    amount_vnd: 90000,
    status: "confirmed",
    origin: "live",
    confirmed_by: "Lan",
    confirmed_at: "2026-10-13T01:30:00.000Z",
    created_at: "2026-10-13T01:00:00.000Z",
    shipped_at: null,
    carrier: null,
    tracking_code: null,
})

const ACTION: SalesAction = { id: "msg-1", status: "queued", workItemId: "item-1", errorCode: null }

const request: SalesItemRequest = { workspaceId: "ws-1", locale: "en", id: "item-1" }

const build = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const catalog = mock<MessageCatalog>({
        get: jest.fn(
            (key: string, params: Readonly<Record<string, string | number>>) => `${key}${JSON.stringify(params)}`,
        ),
    })
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(memberOf())
    const decisions = mock<DecisionsService>()
    decisions.getWorkItem.mockResolvedValue(itemOf())
    const items = mock<WorkItemsService>()
    items.retry.mockResolvedValue(itemOf({ status: "queued" }))
    items.stopFailed.mockResolvedValue(itemOf({ status: "rejected" }))
    const orders = mock<OrdersService>()
    orders.find.mockResolvedValue(orderOf())
    const invoices = mock<InvoicesService>()
    invoices.ofOrder.mockResolvedValue(null)
    const engine = mock<WorkEngineService>()
    engine.runWork.mockResolvedValue(itemOf({ id: "item-9", action: "issue_invoice", status: "queued" }))
    const evidence = mock<EvidenceService>()
    const queue = mock<DecisionsQueue>()
    const status = mock<SalesStatusService>()
    status.queued.mockResolvedValue(ACTION)
    const moduleRef = await Test.createTestingModule({
        providers: [
            SalesWorkService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: DecisionsService, useValue: decisions },
            { provide: WorkItemsService, useValue: items },
            { provide: OrdersService, useValue: orders },
            { provide: InvoicesService, useValue: invoices },
            { provide: WorkEngineService, useValue: engine },
            { provide: EvidenceService, useValue: evidence },
            { provide: DecisionsQueue, useValue: queue },
            { provide: SalesStatusService, useValue: status },
        ],
    }).compile()
    return {
        service: moduleRef.get(SalesWorkService),
        tx,
        members,
        decisions,
        items,
        orders,
        invoices,
        engine,
        evidence,
        queue,
        status,
    }
}

describe("SalesWorkService", () => {
    describe("reopenFailedStep", () => {
        it("reopens the failed step, queues its work and logs the retry in one transaction", async () => {
            const { service, tx, items, queue, status, evidence } = await build()

            await expect(service.reopenFailedStep("user-1", request)).resolves.toEqual(ACTION)

            expect(tx.commits).toBe(1)
            expect(items.retry.mock.calls[0]?.slice(0, 3)).toEqual(["ws-1", "item-1", ["failed"]])
            expect(queue.enqueueRunWork.mock.calls[0]?.[0]).toEqual({
                workspaceId: "ws-1",
                userId: "user-1",
                locale: "en",
                workItemId: "item-1",
                requestId: `item-1:${UPDATED_AT}`,
                intent: "retry",
            })
            expect(status.queued.mock.calls[0]?.slice(1)).toEqual(["ws-1", `decisions.run-work:item-1:${UPDATED_AT}`])
            expect(evidence.log.mock.calls[0]?.slice(0, 2)).toEqual([
                { workspaceId: "ws-1", actor: "Lan", locale: "en" },
                {
                    lead_id: "lead-1",
                    work_item_id: "item-1",
                    kind: "work.retried",
                    actor: "Lan",
                    summary: 'sales.retried{"who":"Lan"}',
                    evidence: "boom",
                },
            ])
        })

        it("refuses a step that has not failed", async () => {
            const { service, tx, decisions } = await build()
            decisions.getWorkItem.mockResolvedValue(itemOf({ status: "queued" }))

            await expect(service.reopenFailedStep("user-1", request)).rejects.toMatchObject({
                code: DecisionsErrorCode.NotFailed,
            })
            expect(tx.outcomes).toEqual([])
        })

        it("refuses staff retrying a step assigned to someone else", async () => {
            const { service, members, decisions } = await build()
            members.require.mockResolvedValue(memberOf({ role: "staff", staffId: "staff-1" }))
            decisions.getWorkItem.mockResolvedValue(itemOf({ assigned_staff_id: "staff-2" }))

            await expect(service.reopenFailedStep("user-1", request)).rejects.toMatchObject({
                code: DecisionsErrorCode.NotAllowed,
            })
        })

        it("rolls back when somebody changed the step first", async () => {
            const { service, tx, items, queue } = await build()
            items.retry.mockResolvedValue(null)

            await expect(service.reopenFailedStep("user-1", request)).rejects.toMatchObject({
                code: DecisionsErrorCode.StateChanged,
            })
            expect(tx.outcomes).toEqual(["rollback"])
            expect(queue.enqueueRunWork).not.toHaveBeenCalled()
        })
    })

    describe("stop", () => {
        it("stops the failed step and records the rejection and the log", async () => {
            const { service, tx, evidence } = await build()

            await expect(service.stop("user-1", request)).resolves.toEqual(itemOf({ status: "rejected" }))

            expect(tx.commits).toBe(1)
            expect(evidence.decide.mock.calls[0]?.slice(0, 2)).toEqual([
                { workspaceId: "ws-1", actor: "Lan", locale: "en" },
                {
                    work_item_id: "item-1",
                    lead_id: "lead-1",
                    department: "sales",
                    action: "send_quote",
                    decided_by: "Lan",
                    decider_kind: "owner",
                    outcome: "rejected",
                    reason: "over_authority",
                    note: "sales.stopNote{}",
                },
            ])
            expect(evidence.log.mock.calls[0]?.[1]).toMatchObject({
                kind: "work.stopped",
                summary: 'sales.stopped{"who":"Lan"}',
            })
        })

        it("records staff as the decider kind of a staff member", async () => {
            const { service, members, decisions, evidence } = await build()
            members.require.mockResolvedValue(memberOf({ role: "staff", staffId: "staff-1" }))
            decisions.getWorkItem.mockResolvedValue(itemOf({ assigned_staff_id: "staff-1" }))

            await service.stop("user-1", request)

            expect(evidence.decide.mock.calls[0]?.[1]).toMatchObject({ decider_kind: "staff" })
        })

        it("refuses a step that has not failed", async () => {
            const { service, decisions } = await build()
            decisions.getWorkItem.mockResolvedValue(itemOf({ status: "done" }))

            await expect(service.stop("user-1", request)).rejects.toMatchObject({
                code: DecisionsErrorCode.NotFailed,
            })
        })

        it("rolls back when the step is no longer failed", async () => {
            const { service, tx, items, evidence } = await build()
            items.stopFailed.mockResolvedValue(null)

            await expect(service.stop("user-1", request)).rejects.toMatchObject({
                code: DecisionsErrorCode.StateChanged,
            })
            expect(tx.outcomes).toEqual(["rollback"])
            expect(evidence.decide).not.toHaveBeenCalled()
        })
    })

    describe("handoff", () => {
        const handoff: SalesItemRequest = { workspaceId: "ws-1", locale: "en", id: "order-1" }

        it("starts the deduped invoice step for a confirmed order and queues it", async () => {
            const { service, tx, engine, items, queue, evidence } = await build()

            await expect(service.handoff("user-1", handoff)).resolves.toEqual(ACTION)

            expect(engine.runWork).toHaveBeenCalledWith(
                { workspaceId: "ws-1", actor: "Lan", locale: "en" },
                {
                    action: "issue_invoice",
                    subject_type: "order",
                    subject_id: "order-1",
                    lead_id: "lead-1",
                    origin: "live",
                    dedupeKey: "issue_invoice:order:order-1",
                    seed: { amount_vnd: 90000, fields: {} },
                    queue: true,
                },
            )
            expect(tx.commits).toBe(1)
            expect(items.retry).not.toHaveBeenCalled()
            expect(queue.enqueueRunWork.mock.calls[0]?.[0]).toMatchObject({ workItemId: "item-9", intent: "handoff" })
            expect(evidence.log.mock.calls[0]?.[1]).toMatchObject({
                kind: "handoff.accounting",
                summary: 'sales.handoff{"who":"Lan","no":"DH-20261013-0001"}',
            })
        })

        it("keeps a simulated order simulated", async () => {
            const { service, orders, engine } = await build()
            orders.find.mockResolvedValue(orderOf({ origin: "simulated" }))

            await service.handoff("user-1", handoff)

            expect(engine.runWork.mock.calls[0]?.[1]).toMatchObject({ origin: "simulated" })
        })

        it.each(["failed", "rejected"] as const)("reopens a %s invoice step before queueing it", async (state) => {
            const { service, engine, items } = await build()
            engine.runWork.mockResolvedValue(itemOf({ id: "item-9", status: state }))

            await expect(service.handoff("user-1", handoff)).resolves.toEqual(ACTION)
            expect(items.retry.mock.calls[0]?.slice(0, 3)).toEqual(["ws-1", "item-9", ["failed", "rejected"]])
        })

        it("rolls back when the invoice step cannot be reopened", async () => {
            const { service, tx, engine, items, queue } = await build()
            engine.runWork.mockResolvedValue(itemOf({ id: "item-9", status: "failed" }))
            items.retry.mockResolvedValue(null)

            await expect(service.handoff("user-1", handoff)).rejects.toMatchObject({
                code: DecisionsErrorCode.StateChanged,
            })
            expect(tx.outcomes).toEqual(["rollback"])
            expect(queue.enqueueRunWork).not.toHaveBeenCalled()
        })

        it("refuses an invoice step that is already done", async () => {
            const { service, tx, engine } = await build()
            engine.runWork.mockResolvedValue(itemOf({ id: "item-9", status: "done" }))

            await expect(service.handoff("user-1", handoff)).rejects.toMatchObject({
                code: DecisionsErrorCode.StateChanged,
            })
            expect(tx.outcomes).toEqual([])
        })

        it("refuses a missing order", async () => {
            const { service, orders } = await build()
            orders.find.mockResolvedValue(null)

            await expect(service.handoff("user-1", handoff)).rejects.toMatchObject({
                code: DecisionsErrorCode.NotFound,
            })
        })

        it("refuses an order that is not confirmed", async () => {
            const { service, orders, engine } = await build()
            orders.find.mockResolvedValue(orderOf({ status: "draft" }))

            await expect(service.handoff("user-1", handoff)).rejects.toMatchObject({
                code: OrdersErrorCode.NotConfirmed,
            })
            expect(engine.runWork).not.toHaveBeenCalled()
        })

        it("refuses an order that already has an invoice", async () => {
            const { service, invoices, engine } = await build()
            invoices.ofOrder.mockResolvedValue(mock<InvoiceRow>({ id: "invoice-1" }))

            await expect(service.handoff("user-1", handoff)).rejects.toMatchObject({
                code: OrdersErrorCode.AlreadyInvoiced,
            })
            expect(engine.runWork).not.toHaveBeenCalled()
        })
    })
})
