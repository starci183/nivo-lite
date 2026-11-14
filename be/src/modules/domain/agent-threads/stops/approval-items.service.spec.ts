import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { WorkItemsService, type WorkItem } from "@modules/domain/work-items"
import { MESSAGE_CATALOG, type MessageCatalog } from "@modules/platform/i18n"
import { ApprovalItemsService, type ApprovalItemRaise } from "./approval-items.service"

const NOW = "2026-11-13T08:00:00.000Z"

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "approve_tool_call",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "waiting_decision",
    decided_path: null,
    reason: "branch_ask",
    reasons: ["branch_ask"],
    missing_fields: [],
    proposal: { summary: "Approve the QR", fields: { engine: "langgraph", runId: "run-1" } },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    created_at: NOW,
    updated_at: NOW,
    completed_at: null,
    installation_id: "inst-1",
})

const RAISE: ApprovalItemRaise = {
    workspaceId: "ws-1",
    department: "sales",
    action: "approve_tool_call",
    subjectType: "lead",
    subjectId: "lead-1",
    leadId: "lead-1",
    dedupeKey: "tool-approval:run-1:qr:fff",
    proposal: { summary: "Approve the QR", fields: { engine: "langgraph", runId: "run-1" } },
}

const build = async (store: Partial<Record<keyof WorkItemsService, jest.Mock>> = {}) => {
    const items = mock<WorkItemsService>({
        insert: jest.fn().mockResolvedValue(itemOf({ status: "queued" })),
        markWaiting: jest.fn().mockResolvedValue(itemOf()),
        findByDedupe: jest.fn().mockResolvedValue(itemOf()),
        findMany: jest.fn().mockResolvedValue([itemOf()]),
        reopen: jest.fn().mockResolvedValue(itemOf({ status: "queued" })),
        markDone: jest.fn().mockResolvedValue(itemOf({ status: "done" })),
        markRejected: jest.fn().mockResolvedValue(itemOf({ status: "rejected" })),
        markFailed: jest.fn().mockResolvedValue(itemOf({ status: "failed" })),
        ...store,
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ApprovalItemsService,
            { provide: WorkItemsService, useValue: items },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>({ get: jest.fn((key: string) => `[${key}]`) }) },
        ],
    }).compile()
    return { service: moduleRef.get(ApprovalItemsService), items }
}

describe("ApprovalItemsService.raise", () => {
    it("inserts the item once and leaves it waiting for a person, for the reason a node on `ask` gives", async () => {
        const { service, items } = await build()

        await expect(service.raise(RAISE)).resolves.toMatchObject({ id: "item-1", status: "waiting_decision" })

        expect(items.insert).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            chainId: null,
            depth: 0,
            department: "sales",
            action: "approve_tool_call",
            subjectType: "lead",
            subjectId: "lead-1",
            leadId: "lead-1",
            inboundEventId: null,
            parentId: null,
            dedupeKey: RAISE.dedupeKey,
            proposal: RAISE.proposal,
            installationId: null,
        })
        expect(items.markWaiting).toHaveBeenCalledWith("item-1", {
            reason: "branch_ask",
            reasons: ["branch_ask"],
            missing: [],
            proposal: RAISE.proposal,
            executionId: null,
        })
    })

    it("answers the item its key already stands for, and marks nothing again", async () => {
        const { service, items } = await build({ insert: jest.fn().mockResolvedValue(null) })

        await expect(service.raise(RAISE)).resolves.toMatchObject({ id: "item-1" })

        expect(items.findByDedupe).toHaveBeenCalledWith("ws-1", RAISE.dedupeKey)
        expect(items.markWaiting).not.toHaveBeenCalled()
    })
})

describe("ApprovalItemsService: one verdict closes an item", () => {
    it("finds an item only in its own workspace", async () => {
        const { service } = await build({ findMany: jest.fn().mockResolvedValue([itemOf({ workspace_id: "ws-2" })]) })

        await expect(service.find("ws-1", "item-1")).resolves.toBeNull()
    })

    it("an approval closes the taken item done by a person, keeping who approved", async () => {
        const { service, items } = await build()

        await service.approved(itemOf({ status: "queued" }), "member-owner")

        expect(items.markDone).toHaveBeenCalledWith("item-1", {
            path: "human",
            proposal: { summary: "Approve the QR", fields: { engine: "langgraph", runId: "run-1", approvedBy: "member-owner" } },
            result: { summary: "Approve the QR" },
            evidence: "captured",
            leadId: null,
        })
    })

    it("a withdrawal takes the item while it waits and closes it refused with why; an item that no longer waits stays as it is", async () => {
        const waiting = await build()
        const decided = await build({ reopen: jest.fn().mockResolvedValue(null) })

        await expect(waiting.service.withdrawn("ws-1", "item-1", "vi", "withdrawn:stop_skip")).resolves.toBe(true)
        await expect(decided.service.withdrawn("ws-1", "item-1", "vi", "withdrawn:stop_skip")).resolves.toBe(false)

        expect(waiting.items.reopen).toHaveBeenCalledWith("ws-1", "item-1")
        expect(waiting.items.markRejected).toHaveBeenCalledWith(
            "item-1",
            { summary: "Approve the QR", fields: { engine: "langgraph", runId: "run-1", closedAs: "withdrawn:stop_skip" } },
            { summary: "[engine.rejectedResult]" },
        )
        expect(decided.items.markRejected).not.toHaveBeenCalled()
    })

    it("keeps no item in an app without the work items store", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [ApprovalItemsService, { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>() }],
        }).compile()
        const service = moduleRef.get(ApprovalItemsService)

        await expect(service.raise(RAISE)).resolves.toBeNull()
        await expect(service.withdrawn("ws-1", "item-1", "vi", "withdrawn:run_closed")).resolves.toBe(false)
        await expect(service.find("ws-1", "item-1")).resolves.toBeNull()
    })
})
