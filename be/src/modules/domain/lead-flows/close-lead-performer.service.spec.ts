import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { WORK_PERFORMER_REGISTRY } from "@modules/domain/decisions"
import type { WorkContext, WorkItem, WorkPerformerRegistry } from "@modules/domain/decisions"
import { CloseLeadPerformerService } from "./close-lead-performer.service"
import { LeadFlowsError, LeadFlowsErrorCode } from "./errors/lead-flows.error"
import { LeadFlowConversationService } from "./lead-flow-conversation.service"
import { LeadFlowKitService } from "./lead-flow-kit.service"
import { LeadFlowMetaService } from "./lead-flow-meta.service"
import { LeadFlowStoreService } from "./lead-flow-store.service"
import { EMPTY_SIGNALS } from "./lead-flow-score.policy"
import type { LeadFlow } from "./lead-flows.contracts"

const NOW = "2026-10-12T10:00:00.000Z"
const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "en" }

const flowOf = builder<LeadFlow>({
    id: "flow-1",
    workspace_id: "ws-1",
    lead_id: "lead-1",
    connection_id: "connection-1",
    conversation_id: "conv-1",
    platform: "facebook",
    psid: "person-1",
    igsid: null,
    phone: null,
    email: null,
    name: "Lan",
    state: "nurturing",
    resume_state: null,
    source: null,
    touches: [],
    answers: [],
    asked: 0,
    pending_question: null,
    contact_asked_at: null,
    signals: EMPTY_SIGNALS,
    score: "cold",
    score_reasons: [],
    scored_at: null,
    analysis: null,
    last_user_at: null,
    last_user_text: null,
    greeted_at: null,
    handed_off_at: null,
    followed_up_at: null,
    closed_at: null,
    escalated_at: null,
    escalation_reason: null,
})

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "lead_gen",
    action: "close_lead",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    parent_id: null,
    chain_id: "chain-1",
    depth: 1,
    status: "queued",
    decided_path: "auto",
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    created_at: NOW,
    updated_at: NOW,
    completed_at: null,
    installation_id: null,
})

const build = async () => {
    const registry = mock<WorkPerformerRegistry>()
    const store = mock<LeadFlowStoreService>()
    const kit = mock<LeadFlowKitService>({
        store,
        meta: mock<LeadFlowMetaService>(),
        transcript: mock<LeadFlowConversationService>(),
    })
    kit.text.mockImplementation((_locale, key) => key)
    kit.nameOf.mockReturnValue("Lan")
    kit.now.mockReturnValue(NOW)
    kit.done.mockImplementation((summary, flow, detail = null) => ({
        summary,
        evidence: "captured",
        lead_id: flow?.lead_id ?? null,
        detail,
    }))
    kit.metaRefused.mockImplementation(
        (failure) =>
            new LeadFlowsError({ code: LeadFlowsErrorCode.MetaRefused, params: { failure: failure ?? "error" } }),
    )
    store.requireByLead.mockResolvedValue(flowOf())
    const moduleRef = await Test.createTestingModule({
        providers: [
            CloseLeadPerformerService,
            { provide: WORK_PERFORMER_REGISTRY, useValue: registry },
            { provide: LeadFlowKitService, useValue: kit },
        ],
    }).compile()
    return { performer: moduleRef.get(CloseLeadPerformerService), registry, kit, store }
}

describe("CloseLeadPerformerService", () => {
    it("registers close_lead at boot", async () => {
        const { performer, registry } = await build()

        performer.onModuleInit()

        expect(registry.add).toHaveBeenCalledWith("close_lead", performer)
    })

    it("prepares the reply of the turn and the closing line", async () => {
        const { performer, kit } = await build()
        const prepared = { proposal: { summary: "close.summary", fields: {}, draft: "Bye" } }
        kit.lineProposal.mockResolvedValue(prepared)

        await expect(performer.prepare(ctx, itemOf())).resolves.toBe(prepared)

        expect(kit.lineProposal).toHaveBeenCalledWith(ctx, itemOf(), "line.close", "close.summary")
    })

    it("sends the closing line and closes the flow", async () => {
        const { performer, kit, store } = await build()
        kit.dm.mockResolvedValue({ ok: true, reason: null, detail: null })

        await expect(performer.perform(ctx, itemOf(), { summary: "", fields: {}, draft: " Bye " })).resolves.toEqual({
            summary: "close.done",
            evidence: "captured",
            lead_id: "lead-1",
            detail: "Bye",
        })

        expect(kit.dm).toHaveBeenCalledWith(ctx, flowOf(), "Bye")
        expect(store.patch).toHaveBeenCalledWith(flowOf(), { state: "closed", closed_at: NOW, pending_question: null })
    })

    it("closes silently outside the window and says so when there is nothing to send", async () => {
        const { performer, kit, store } = await build()
        kit.dm.mockResolvedValue({ ok: false, reason: "window", detail: null })

        await expect(
            performer.perform(ctx, itemOf(), { summary: "", fields: {}, draft: "Bye" }),
        ).resolves.toMatchObject({
            summary: "close.silent",
            detail: null,
        })
        await expect(performer.perform(ctx, itemOf(), { summary: "", fields: {} })).resolves.toMatchObject({
            summary: "close.already",
        })

        expect(kit.dm).toHaveBeenCalledTimes(1)
        expect(store.patch).toHaveBeenCalledTimes(1)
    })

    it("refuses when Meta fails the send and leaves the flow open", async () => {
        const { performer, kit, store } = await build()
        kit.dm.mockResolvedValue({ ok: false, reason: "failed", detail: "token" })

        await expect(performer.perform(ctx, itemOf(), { summary: "", fields: {}, draft: "Bye" })).rejects.toMatchObject(
            {
                code: LeadFlowsErrorCode.MetaRefused,
            },
        )

        expect(store.patch).not.toHaveBeenCalled()
    })
})
