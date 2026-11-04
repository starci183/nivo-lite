import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { AgentRunResumeService } from "@modules/domain/agent-runs"
import type { ResumeResult } from "@modules/domain/agent-runs"
import type { PerformedBy, Proposal, WorkContext, WorkItem } from "@modules/domain/decisions"
import { WorkPerformersErrorCode } from "./errors/work-performers.error"
import { PerformerKitService } from "./performer-kit.service"
import { ResumeRunPerformerService } from "./resume-run-performer.service"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "en" }

const fields: Proposal["fields"] = { runId: "run-1", code: "invalid_step_input", conversationId: "conv-1" }

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "chatbot",
    action: "review_agent_run",
    subject_type: "conversation",
    subject_id: "conv-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "queued",
    decided_path: null,
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "The AI could not handle a message", fields },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    created_at: "2026-11-11T09:00:00.000Z",
    updated_at: "2026-11-11T09:00:00.000Z",
    completed_at: null,
    installation_id: "inst-1",
})

const RESUMED: ResumeResult = { kind: "resumed", stepKey: "turn", workspaceId: "ws-1" }

const build = async (answer: ResumeResult = RESUMED) => {
    const kit = mock<PerformerKitService>()
    kit.text.mockImplementation((_ctx, key) => key)
    const resumes = mock<AgentRunResumeService>({ resume: jest.fn().mockResolvedValue(answer) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ResumeRunPerformerService,
            { provide: PerformerKitService, useValue: kit },
            { provide: AgentRunResumeService, useValue: resumes },
        ],
    }).compile()
    return { service: moduleRef.get(ResumeRunPerformerService), resumes }
}

const OWNER: PerformedBy = { name: "Lan", kind: "owner", memberId: "member-1" }

describe("ResumeRunPerformerService.prepare", () => {
    it("keeps the proposal the road that raised the item preset", async () => {
        const { service } = await build()
        const item = itemOf()

        await expect(service.prepare(ctx, item)).resolves.toEqual({ proposal: item.proposal })
    })
})

describe("ResumeRunPerformerService.perform", () => {
    it("puts the run the item names back on its failed step, as the member who approved, and says so", async () => {
        const { service, resumes } = await build()
        const item = itemOf()

        await expect(service.perform(ctx, item, item.proposal, OWNER)).resolves.toEqual({
            summary: "runResumed",
            evidence: "captured",
            lead_id: "lead-1",
        })
        expect(resumes.resume).toHaveBeenCalledWith({ runId: "run-1", actor: "member-1", reason: "item item-1" })
    })

    it("records the display name when the actor is not a member", async () => {
        const { service, resumes } = await build()
        const item = itemOf()

        await service.perform(ctx, item, item.proposal, { name: "NIVO" })

        expect(resumes.resume).toHaveBeenCalledWith(expect.objectContaining({ actor: "NIVO" }))
    })

    it("refuses an item that names no run, and a run that cannot be resumed", async () => {
        const noRun = await build()
        const gone = await build({ kind: "compensated" })
        const item = itemOf()

        await expect(noRun.service.perform(ctx, item, { summary: "x", fields: {} }, OWNER)).rejects.toMatchObject({
            code: WorkPerformersErrorCode.ApprovalInvalid,
        })
        await expect(gone.service.perform(ctx, item, item.proposal, OWNER)).rejects.toMatchObject({
            code: WorkPerformersErrorCode.ApprovalInvalid,
        })
    })
})
