import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { ThreadRunsService } from "@modules/domain/agent-threads"
import { ThreadApprovalsService } from "@modules/domain/agent-threads/thread-approvals.service"
import { WORK_PERFORMER_REGISTRY } from "@modules/domain/decisions"
import type { PerformedBy, Proposal, WorkContext, WorkItem, WorkPerformerRegistry } from "@modules/domain/decisions"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import type { MemberSeatRecord } from "@modules/domain/workspace-members"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { WorkPerformersErrorCode } from "./errors/work-performers.error"
import { ToolApprovalPerformerService } from "./tool-approval-performer.service"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "vi" }

const THREAD_FIELDS: Proposal["fields"] = {
    engine: "langgraph",
    runId: "run-1",
    stepKey: "qr",
    tool: "nivo.payment.qr.create",
    fingerprint: "f".repeat(64),
}

/** A left-over item of the deleted old engine: its fields name no engine. */
const OLD_FIELDS: Proposal["fields"] = {
    runId: "run-0",
    nodeKey: "qr",
    tool: "nivo.payment.qr.create",
    fingerprint: "f".repeat(64),
}

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
    reasons: [],
    missing_fields: [],
    proposal: { summary: "The AI needs your approval before it runs nivo.payment.qr.create", fields: THREAD_FIELDS },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    created_at: "2026-11-12T08:00:00.000Z",
    updated_at: "2026-11-12T08:00:00.000Z",
    completed_at: null,
    installation_id: "inst-1",
})

const OWNER: PerformedBy = { name: "Lan", kind: "owner", memberId: "member-owner" }
const MANAGER: PerformedBy = { name: "Minh", kind: "owner", memberId: "member-manager" }
const ENGINE: PerformedBy = { name: "NIVO", kind: "staff" }

const SEATS: Readonly<Record<string, MemberSeatRecord>> = {
    "member-owner": { memberId: "member-owner", userId: "u1", role: "owner", displayName: "Lan", status: "active" },
    "member-manager": {
        memberId: "member-manager",
        userId: "u2",
        role: "manager",
        displayName: "Minh",
        status: "active",
    },
}

const build = async (decided: unknown = { kind: "admitted", fresh: true }) => {
    const registry = mock<WorkPerformerRegistry>()
    const approvals = mock<ThreadApprovalsService>({ decided: jest.fn().mockResolvedValue(decided) })
    const runs = mock<ThreadRunsService>()
    const seats = mock<WorkspaceMemberSeatsService>({
        seatById: jest.fn((_ws: string, memberId: string) => Promise.resolve(SEATS[memberId] ?? null)),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ToolApprovalPerformerService,
            { provide: WORK_PERFORMER_REGISTRY, useValue: registry },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>({ get: jest.fn((key: string) => `[${key}]`) }) },
            { provide: ThreadApprovalsService, useValue: approvals },
            { provide: ThreadRunsService, useValue: runs },
            { provide: WorkspaceMemberSeatsService, useValue: seats },
        ],
    }).compile()
    return { service: moduleRef.get(ToolApprovalPerformerService), registry, approvals, runs }
}

describe("ToolApprovalPerformerService", () => {
    it("registers for the approval of one tool call", async () => {
        const { service, registry } = await build()

        service.onModuleInit()

        expect(registry.add).toHaveBeenCalledWith("approve_tool_call", service)
    })

    it("hands the owner's approval of a thread item to the run's approval stop, with the thread runs to resume it", async () => {
        const { service, approvals, runs } = await build()
        const item = itemOf()

        const performed = await service.perform(ctx, item, item.proposal, OWNER)

        expect(performed).toEqual({ summary: item.proposal.summary, evidence: "captured", lead_id: "lead-1" })
        expect(approvals.decided).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                runId: "run-1",
                stepKey: "qr",
                workItemId: "item-1",
                verdict: "approved",
                by: "member-owner",
                text: "[performers.toolApprovalRefused]",
            },
            runs,
        )
    })

    it("refuses an approval by anyone but the workspace owner, and hands the thread nothing", async () => {
        const { service, approvals } = await build()
        const item = itemOf()

        await expect(service.perform(ctx, item, item.proposal, MANAGER)).rejects.toMatchObject({
            code: WorkPerformersErrorCode.ApprovalNotOwner,
        })
        await expect(service.perform(ctx, item, item.proposal, ENGINE)).rejects.toMatchObject({
            code: WorkPerformersErrorCode.ApprovalNotOwner,
        })
        expect(approvals.decided).not.toHaveBeenCalled()
    })

    it("does not pass an approval the run no longer waits for", async () => {
        const { service } = await build({ kind: "refused", code: "thread_not_waiting" })
        const item = itemOf()

        await expect(service.perform(ctx, item, item.proposal, OWNER)).rejects.toMatchObject({
            code: WorkPerformersErrorCode.ApprovalInvalid,
        })
    })
})

describe("ToolApprovalPerformerService, refusals and items of no thread", () => {
    it("hands a refusal by a person in words, and the deadline's refusal without a person", async () => {
        const { service, approvals, runs } = await build()
        const item = itemOf()

        await service.onReject(ctx, item, item.proposal, MANAGER)
        await service.onReject(ctx, item, item.proposal, ENGINE)

        expect(approvals.decided).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                verdict: "refused",
                by: "member-manager",
                text: "[performers.toolApprovalRefused]",
            }),
            runs,
        )
        expect(approvals.decided).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ verdict: "refused", by: null }),
            runs,
        )
    })

    it("a refusal of an item whose run moved on still passes: nothing waits to be told", async () => {
        const { service } = await build({ kind: "refused", code: "thread_not_waiting" })
        const item = itemOf()

        await expect(service.onReject(ctx, item, item.proposal, OWNER)).resolves.toBeUndefined()
    })

    it("does not pass an approval of an item no thread raised, and a refusal of it changes nothing", async () => {
        const { service, approvals } = await build()
        const item = itemOf({ proposal: { summary: "old", fields: OLD_FIELDS } })

        await expect(service.perform(ctx, item, item.proposal, OWNER)).rejects.toMatchObject({
            code: WorkPerformersErrorCode.ApprovalInvalid,
        })
        await expect(service.onReject(ctx, item, item.proposal, OWNER)).resolves.toBeUndefined()
        expect(approvals.decided).not.toHaveBeenCalled()
    })

    it("fails a thread item that names no run or step", async () => {
        const { service } = await build()
        const item = itemOf({ proposal: { summary: "x", fields: { engine: "langgraph" } } })

        await expect(service.onReject(ctx, item, item.proposal, OWNER)).rejects.toMatchObject({
            code: WorkPerformersErrorCode.ApprovalInvalid,
        })
    })
})
