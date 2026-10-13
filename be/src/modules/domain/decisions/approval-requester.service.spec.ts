import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import type { ToolContext } from "@modules/domain/agent-tools"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ApprovalRequesterService } from "./approval-requester.service"
import type { WorkItem } from "./decisions.contracts"
import { WorkEngineService } from "./work-engine.service"

const ctx: ToolContext = { workspaceId: "ws-1", conversationId: "conversation-1", jobId: "job-1" }

const itemOf = builder<WorkItem>({
    id: "approval-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "reply_customer",
    subject_type: "conversation",
    subject_id: "conversation-1",
    lead_id: null,
    inbound_event_id: null,
    parent_id: null,
    chain_id: "approval-1",
    depth: 0,
    status: "waiting_decision",
    decided_path: null,
    reason: "over_authority",
    reasons: ["over_authority"],
    missing_fields: [],
    proposal: { summary: "Owner approval", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "live",
    created_at: "2026-10-13T09:00:00.000Z",
    updated_at: "2026-10-13T09:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

const setup = async (item: WorkItem = itemOf()) => {
    const engine = mock<WorkEngineService>()
    engine.runWork.mockResolvedValue(item)
    const catalog = mock<MessageCatalog>()
    catalog.get.mockReturnValue("Catalog reply summary")
    const moduleRef = await Test.createTestingModule({
        providers: [
            ApprovalRequesterService,
            { provide: WorkEngineService, useValue: engine },
            { provide: MESSAGE_CATALOG, useValue: catalog },
        ],
    }).compile()

    return { subject: moduleRef.get(ApprovalRequesterService), engine, catalog }
}

describe("ApprovalRequesterService", () => {
    it("asks for a preset customer reply and clips only the catalog question to 160 characters", async () => {
        const { subject, engine, catalog } = await setup()
        const question = `${"q".repeat(160)}Keep this part in the work item`

        await expect(
            subject.request(ctx, { question, proposedAnswer: "Proposed reply", reason: "over_authority" }),
        ).resolves.toEqual({ workItemId: "approval-1", status: "waiting_decision" })

        expect(catalog.get).toHaveBeenCalledTimes(1)
        expect(catalog.get).toHaveBeenCalledWith("engine.replySummary", { question: "q".repeat(160) }, "vi")
        expect(engine.runWork).toHaveBeenCalledTimes(1)
        expect(engine.runWork).toHaveBeenCalledWith(
            { workspaceId: "ws-1", actor: "NIVO", locale: "vi" },
            {
                action: "reply_customer",
                subject_type: "conversation",
                subject_id: "conversation-1",
                dedupeKey: "reply_customer:engine:job-1",
                origin: "live",
                preset: true,
                noChain: true,
                forceAsk: "over_authority",
                seed: {
                    summary: "Catalog reply summary",
                    draft: "Proposed reply",
                    fields: { question, conversation_id: "conversation-1" },
                },
            },
        )
    })

    it("uses an empty draft without a proposed answer and maps the returned item's id and status", async () => {
        const { subject, engine, catalog } = await setup(itemOf({ id: "existing-2", status: "done" }))
        const otherCtx: ToolContext = { workspaceId: "ws-2", conversationId: "conversation-2", jobId: "job-2" }

        await expect(
            subject.request(otherCtx, {
                question: "Can you confirm delivery?",
                proposedAnswer: null,
                reason: "unclear_outcome",
            }),
        ).resolves.toEqual({ workItemId: "existing-2", status: "done" })

        expect(catalog.get).toHaveBeenCalledTimes(1)
        expect(catalog.get).toHaveBeenCalledWith("engine.replySummary", { question: "Can you confirm delivery?" }, "vi")
        expect(engine.runWork).toHaveBeenCalledTimes(1)
        expect(engine.runWork).toHaveBeenCalledWith(
            { workspaceId: "ws-2", actor: "NIVO", locale: "vi" },
            {
                action: "reply_customer",
                subject_type: "conversation",
                subject_id: "conversation-2",
                dedupeKey: "reply_customer:engine:job-2",
                origin: "live",
                preset: true,
                noChain: true,
                forceAsk: "unclear_outcome",
                seed: {
                    summary: "Catalog reply summary",
                    draft: "",
                    fields: { question: "Can you confirm delivery?", conversation_id: "conversation-2" },
                },
            },
        )
    })
})
