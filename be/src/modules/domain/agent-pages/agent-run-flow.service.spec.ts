import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import {
    ThreadApprovalsService,
    ThreadResumeRequestsService,
    type ApprovalVerdictOutcome,
} from "@modules/domain/agent-threads"
import { AgentWorkErrorCode } from "@modules/domain/agent-work"
import { WorkspaceMembersService, type WorkspaceMember, type WorkspaceRole } from "@modules/domain/workspace-members"
import { AgentRunFlowService } from "./agent-run-flow.service"

const memberAs = (role: WorkspaceRole): WorkspaceMember =>
    builder<WorkspaceMember>({
        userId: "user-1",
        workspaceId: "ws-1",
        role,
        staffId: null,
        displayName: "An",
        status: "active",
    })()

const build = async (
    role: WorkspaceRole | null = "owner",
    outcome: ApprovalVerdictOutcome = { kind: "decided", workItemId: "item-1", status: "done" },
) => {
    const verdict = jest.fn().mockResolvedValue(outcome)
    const approvals = mock<ThreadApprovalsService>({ verdict })
    const threads = mock<ThreadResumeRequestsService>()
    const members = mock<WorkspaceMembersService>({
        require:
            role === null
                ? jest.fn().mockRejectedValue(new Error("WORKSPACE_MEMBERS_NOT_MEMBER"))
                : jest.fn().mockResolvedValue(memberAs(role)),
        idOf: jest.fn().mockResolvedValue("member-1"),
    })
    const container = await Test.createTestingModule({
        providers: [
            AgentRunFlowService,
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ThreadApprovalsService, useValue: approvals },
            { provide: ThreadResumeRequestsService, useValue: threads },
        ],
    }).compile()
    const service = container.get(AgentRunFlowService)
    const run = (payload: object) => service.decide("user-1", "ws-1", payload)
    return { run, verdict, threads, members }
}

describe("AgentRunFlowService.decide (kind decide): the work item's verdict through the thread approvals' one door", () => {
    it("hands the owner's approval to the thread approvals and answers the item it closed", async () => {
        const { run, verdict, threads, members } = await build()

        await expect(run({ workItemId: "item-1", decision: "approved", locale: "en" })).resolves.toEqual({
            data: { id: "item-1", status: "done" },
        })
        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", [])
        expect(verdict).toHaveBeenCalledWith(
            { workspaceId: "ws-1", workItemId: "item-1", verdict: "approved", by: "member-1", owner: true, locale: "en" },
            threads,
        )
    })

    it("hands a manager's refusal on as a refusal by a member who is not the owner, in Vietnamese unless English is named", async () => {
        const { run, verdict } = await build("manager", { kind: "decided", workItemId: "item-1", status: "rejected" })

        await expect(run({ work_item_id: "item-1", decision: "rejected" })).resolves.toEqual({
            data: { id: "item-1", status: "rejected" },
        })
        expect(verdict).toHaveBeenNthCalledWith(
            1,
            { workspaceId: "ws-1", workItemId: "item-1", verdict: "refused", by: "member-1", owner: false, locale: "vi" },
            expect.anything(),
        )
    })

    it("refuses a staff member, and a stranger, before anything is decided", async () => {
        const staff = await build("staff")
        const stranger = await build(null)

        await expect(staff.run({ workItemId: "item-1", decision: "rejected" })).rejects.toMatchObject({
            code: AgentWorkErrorCode.ApprovalNotAllowed,
        })
        await expect(stranger.run({ workItemId: "item-1", decision: "rejected" })).rejects.toThrow("WORKSPACE_MEMBERS_NOT_MEMBER")
        expect(staff.verdict).not.toHaveBeenCalled()
        expect(stranger.verdict).not.toHaveBeenCalled()
    })

    it.each([
        ["not_found", AgentWorkErrorCode.ApprovalNotFound],
        ["not_owner", AgentWorkErrorCode.ApprovalNotOwner],
        ["not_waiting", AgentWorkErrorCode.ApprovalNotWaiting],
        ["thread_not_waiting", AgentWorkErrorCode.ApprovalNotWaiting],
    ] as const)("answers the door's refusal %s as its typed error", async (code, expected) => {
        const { run } = await build("owner", { kind: "refused", code })

        await expect(run({ workItemId: "item-1", decision: "approved" })).rejects.toMatchObject({ code: expected })
    })

    it.each([
        [{ workItemId: "item-1" }, "decision"],
        [{ workItemId: "item-1", decision: "maybe" }, "decision"],
        [{ decision: "approved" }, "workItemId"],
        [{ workItemId: 7, decision: "approved" }, "workItemId"],
    ])("refuses the inputs %j, naming the field, and decides nothing", async (payload, field) => {
        const { run, verdict } = await build()

        await expect(run(payload)).rejects.toMatchObject({
            code: AgentWorkErrorCode.ApprovalPayloadInvalid,
            params: { field },
        })
        expect(verdict).not.toHaveBeenCalled()
    })
})
