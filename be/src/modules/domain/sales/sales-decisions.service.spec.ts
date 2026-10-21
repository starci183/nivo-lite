import { Test } from "@nestjs/testing"
import { builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { DecisionsErrorCode, DecisionsService } from "@modules/domain/decisions"
import type { WorkItem } from "@modules/domain/decisions"
import { ExecutionsService } from "@modules/domain/executions"
import type { ExecutionRow } from "@modules/domain/executions"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { DecisionsQueue } from "@modules/queues/decisions"
import { SalesDecisionsService } from "./sales-decisions.service"
import { SalesStatusService } from "./sales-status.service"
import type { SalesAction, SalesDecisionRequest, SalesDraftRequest } from "./sales.contracts"

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
    status: "waiting_decision",
    decided_path: null,
    reason: "over_authority",
    reasons: [],
    missing_fields: [],
    proposal: { summary: "S", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
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

const cardOf = builder<ExecutionRow>({
    id: "exec-1",
    status: "pending_approval",
    work_item_id: null,
    draft: "Hello",
})

const ACTION: SalesAction = { id: "msg-1", status: "queued", workItemId: "item-1", errorCode: null }

const decision: SalesDecisionRequest = {
    workspaceId: "ws-1",
    locale: "en",
    id: "item-1",
    decision: "approved",
    note: "ok",
}

const draftDecision: SalesDraftRequest = {
    workspaceId: "ws-1",
    locale: "en",
    id: "exec-1",
    decision: "approved",
    editedDraft: "Hi",
}

const build = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(memberOf())
    const decisions = mock<DecisionsService>()
    decisions.getWorkItem.mockResolvedValue(itemOf())
    const executions = mock<ExecutionsService>()
    executions.find.mockResolvedValue(cardOf())
    const queue = mock<DecisionsQueue>()
    const status = mock<SalesStatusService>()
    status.queued.mockResolvedValue(ACTION)
    const moduleRef = await Test.createTestingModule({
        providers: [
            SalesDecisionsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: DecisionsService, useValue: decisions },
            { provide: ExecutionsService, useValue: executions },
            { provide: DecisionsQueue, useValue: queue },
            { provide: SalesStatusService, useValue: status },
        ],
    }).compile()
    return { service: moduleRef.get(SalesDecisionsService), tx, members, decisions, executions, queue, status }
}

describe("SalesDecisionsService decideWorkItem", () => {
    it("queues the decision keyed by the item version and answers the queued action", async () => {
        const { service, tx, queue, status } = await build()

        await expect(service.decideWorkItem("user-1", decision)).resolves.toEqual(ACTION)

        expect(tx.commits).toBe(1)
        expect(queue.enqueueDecideWork.mock.calls[0]?.[0]).toEqual({
            workspaceId: "ws-1",
            userId: "user-1",
            locale: "en",
            workItemId: "item-1",
            decision: "approved",
            edits: undefined,
            note: "ok",
            basis: undefined,
        })
        expect(queue.enqueueDecideWork.mock.calls[0]?.[2]).toBe(`item-1:${UPDATED_AT}`)
        expect(status.queued.mock.calls[0]?.slice(1)).toEqual(["ws-1", `decisions.decide-work:item-1:${UPDATED_AT}`])
    })

    it("lets assigned staff decide their own item", async () => {
        const { service, members, decisions } = await build()
        members.require.mockResolvedValue(memberOf({ role: "staff", staffId: "staff-1" }))
        decisions.getWorkItem.mockResolvedValue(itemOf({ assigned_staff_id: "staff-1" }))

        await expect(service.decideWorkItem("user-1", decision)).resolves.toEqual(ACTION)
    })

    it("refuses staff deciding an item assigned to someone else", async () => {
        const { service, tx, members, decisions, queue } = await build()
        members.require.mockResolvedValue(memberOf({ role: "staff", staffId: "staff-1" }))
        decisions.getWorkItem.mockResolvedValue(itemOf({ assigned_staff_id: "staff-2" }))

        await expect(service.decideWorkItem("user-1", decision)).rejects.toMatchObject({
            code: DecisionsErrorCode.NotAllowed,
        })
        expect(tx.outcomes).toEqual([])
        expect(queue.enqueueDecideWork).not.toHaveBeenCalled()
    })

    it("refuses an item that no longer waits for a decision", async () => {
        const { service, decisions, queue } = await build()
        decisions.getWorkItem.mockResolvedValue(itemOf({ status: "done" }))

        await expect(service.decideWorkItem("user-1", decision)).rejects.toMatchObject({
            code: DecisionsErrorCode.NotWaiting,
        })
        expect(queue.enqueueDecideWork).not.toHaveBeenCalled()
    })
})

describe("SalesDecisionsService decideDraft", () => {
    it("queues a manager's decision on a card without a work item keyed by the card", async () => {
        const { service, tx, queue, status, decisions } = await build()

        await expect(service.decideDraft("user-1", draftDecision)).resolves.toEqual(ACTION)

        expect(tx.commits).toBe(1)
        expect(decisions.getWorkItem).not.toHaveBeenCalled()
        expect(queue.enqueueDecideExecution.mock.calls[0]?.[0]).toEqual({
            workspaceId: "ws-1",
            userId: "user-1",
            locale: "en",
            executionId: "exec-1",
            decision: "approved",
            editedDraft: "Hi",
        })
        expect(queue.enqueueDecideExecution.mock.calls[0]?.[2]).toBe("exec-1")
        expect(status.queued.mock.calls[0]?.slice(1)).toEqual(["ws-1", "decisions.decide-execution:exec-1"])
    })

    it("keys a card with a work item by the card and the item version", async () => {
        const { service, executions, queue } = await build()
        executions.find.mockResolvedValue(cardOf({ work_item_id: "item-1" }))

        await service.decideDraft("user-1", draftDecision)

        expect(queue.enqueueDecideExecution.mock.calls[0]?.[2]).toBe(`exec-1:${UPDATED_AT}`)
    })

    it("refuses staff deciding a card without a work item", async () => {
        const { service, members, queue } = await build()
        members.require.mockResolvedValue(memberOf({ role: "staff", staffId: "staff-1" }))

        await expect(service.decideDraft("user-1", draftDecision)).rejects.toMatchObject({
            code: DecisionsErrorCode.NotAllowed,
        })
        expect(queue.enqueueDecideExecution).not.toHaveBeenCalled()
    })

    it.each([
        ["a missing card", null, DecisionsErrorCode.NotFound],
        ["a decided card", cardOf({ status: "approved" }), DecisionsErrorCode.NotWaiting],
    ])("refuses %s", async (_name, card, code) => {
        const { service, executions } = await build()
        executions.find.mockResolvedValue(card)

        await expect(service.decideDraft("user-1", draftDecision)).rejects.toMatchObject({ code })
    })

    it("refuses a card whose work item no longer waits", async () => {
        const { service, executions, decisions } = await build()
        executions.find.mockResolvedValue(cardOf({ work_item_id: "item-1" }))
        decisions.getWorkItem.mockResolvedValue(itemOf({ status: "done" }))

        await expect(service.decideDraft("user-1", draftDecision)).rejects.toMatchObject({
            code: DecisionsErrorCode.NotWaiting,
        })
    })
})
