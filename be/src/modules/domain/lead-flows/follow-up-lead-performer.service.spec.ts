import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { CommandBusService, WORK_PERFORMER_REGISTRY } from "@modules/domain/decisions"
import type { WorkContext, WorkItem, WorkPerformerRegistry } from "@modules/domain/decisions"
import { LeadFlowsError, LeadFlowsErrorCode } from "./errors/lead-flows.error"
import { FollowUpLeadPerformerService } from "./follow-up-lead-performer.service"
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
    state: "new",
    resume_state: null,
    source: null,
    touches: [],
    answers: [],
    asked: 0,
    pending_question: null,
    contact_asked_at: null,
    signals: EMPTY_SIGNALS,
    score: null,
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
    action: "greet_prospect",
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
    origin: "live",
    created_at: NOW,
    updated_at: NOW,
    completed_at: null,
    installation_id: null,
})

const build = async (flow: LeadFlow = flowOf({ state: "scored", score: "warm" })) => {
    const registry = mock<WorkPerformerRegistry>()
    const store = mock<LeadFlowStoreService>()
    const meta = mock<LeadFlowMetaService>()
    const transcript = mock<LeadFlowConversationService>()
    const kit = mock<LeadFlowKitService>({
        store,
        meta,
        transcript,
    })
    kit.text.mockImplementation((_locale, key) => key)
    kit.nameOf.mockReturnValue("Lan")
    kit.now.mockReturnValue(NOW)
    kit.done.mockImplementation((summary, done, detail = null) => ({
        summary,
        evidence: "captured",
        lead_id: done?.lead_id ?? null,
        detail,
    }))
    kit.metaRefused.mockImplementation(
        (failure) =>
            new LeadFlowsError({ code: LeadFlowsErrorCode.MetaRefused, params: { failure: failure ?? "error" } }),
    )
    store.requireByLead.mockResolvedValue(flow)
    const commands = mock<CommandBusService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            FollowUpLeadPerformerService,
            { provide: WORK_PERFORMER_REGISTRY, useValue: registry },
            { provide: LeadFlowKitService, useValue: kit },
            { provide: CommandBusService, useValue: commands },
        ],
    }).compile()
    return { performer: moduleRef.get(FollowUpLeadPerformerService), registry, kit, store, commands }
}

const proposal = { summary: "", fields: {}, draft: "Still keen?" }

describe("FollowUpLeadPerformerService", () => {
    it("registers follow_up_lead at boot and prepares the follow-up line", async () => {
        const { performer, registry, kit } = await build()
        const prepared = { proposal: { summary: "follow.summary", fields: {}, draft: "Still keen?" } }
        kit.lineProposal.mockResolvedValue(prepared)

        performer.onModuleInit()

        expect(registry.add).toHaveBeenCalledWith("follow_up_lead", performer)
        await expect(performer.prepare(ctx, itemOf())).resolves.toBe(prepared)
        expect(kit.lineProposal).toHaveBeenCalledWith(ctx, itemOf(), "line.follow-up", "follow.summary")
    })

    it("follows up inside the window and stamps the first follow-up", async () => {
        const { performer, kit, store } = await build()
        kit.dm.mockResolvedValue({ ok: true, reason: null, detail: null })

        await expect(performer.perform(ctx, itemOf(), proposal)).resolves.toEqual({
            summary: "follow.done",
            evidence: "captured",
            lead_id: "lead-1",
            detail: "Still keen?",
        })

        expect(store.patch).toHaveBeenCalledWith(flowOf({ state: "scored", score: "warm" }), {
            state: "nurturing",
            followed_up_at: NOW,
        })
    })

    it("hands a first follow-up outside the window to Sales once", async () => {
        const flow = flowOf({ state: "scored", score: "warm" })
        const { performer, kit, store, commands } = await build(flow)
        kit.dm.mockResolvedValue({ ok: false, reason: "window", detail: null })

        await expect(performer.perform(ctx, itemOf({ chain_id: null }), proposal)).resolves.toMatchObject({
            summary: "follow.to-sales",
        })

        expect(commands.sendCommand).toHaveBeenCalledWith(ctx, {
            from: "lead_gen",
            to: "sales",
            command: "send_follow_up",
            reason: "warm_lead_outside_window",
            parentId: "item-1",
            chainId: "item-1",
            origin: "live",
            inboundEventId: null,
            queue: true,
            dedupeKey: "send_follow_up:lead_gen:flow-1",
            payload: { subject_type: "lead", subject_id: "lead-1", lead_id: "lead-1" },
        })
        expect(store.patch).toHaveBeenCalledWith(flow, { state: "nurturing", followed_up_at: NOW })
    })

    it("explains a later follow-up that could not go and refuses a Meta failure", async () => {
        const { performer, kit, store, commands } = await build(flowOf({ followed_up_at: NOW }))
        kit.dm.mockResolvedValueOnce({ ok: false, reason: "window", detail: null })
        kit.notSent.mockReturnValue("not-sent.window")
        kit.dm.mockResolvedValueOnce({ ok: false, reason: "failed", detail: "token" })

        await expect(performer.perform(ctx, itemOf(), proposal)).resolves.toMatchObject({ summary: "not-sent.window" })
        await expect(performer.perform(ctx, itemOf(), proposal)).rejects.toMatchObject({
            code: LeadFlowsErrorCode.MetaRefused,
        })

        expect(commands.sendCommand).not.toHaveBeenCalled()
        expect(store.patch).not.toHaveBeenCalled()
    })

    it("does nothing when there is no line to send", async () => {
        const { performer, kit } = await build()

        await expect(performer.perform(ctx, itemOf(), { summary: "", fields: {}, draft: "  " })).resolves.toMatchObject(
            {
                summary: "follow.already",
            },
        )

        expect(kit.dm).not.toHaveBeenCalled()
    })

    it("sends a later follow-up without changing the first follow-up time", async () => {
        const flow = flowOf({ followed_up_at: "2026-10-11T10:00:00.000Z" })
        const { performer, kit, store, commands } = await build(flow)
        kit.dm.mockResolvedValue({ ok: true, reason: null, detail: null })

        await expect(performer.perform(ctx, itemOf(), { ...proposal, draft: "  Still keen?  " })).resolves.toEqual({
            summary: "follow.done",
            evidence: "captured",
            lead_id: "lead-1",
            detail: "Still keen?",
        })

        expect(kit.dm).toHaveBeenCalledWith(ctx, flow, "Still keen?")
        expect(store.patch).toHaveBeenCalledWith(flow, { state: "nurturing" })
        expect(commands.sendCommand).not.toHaveBeenCalled()
    })

    it("keeps the existing chain when Sales receives the first follow-up", async () => {
        const { performer, kit, commands } = await build()
        kit.dm.mockResolvedValue({ ok: false, reason: "window", detail: null })

        await expect(performer.perform(ctx, itemOf(), proposal)).resolves.toEqual({
            summary: "follow.to-sales",
            evidence: "captured",
            lead_id: "lead-1",
            detail: null,
        })

        expect(commands.sendCommand).toHaveBeenCalledWith(ctx, {
            from: "lead_gen",
            to: "sales",
            command: "send_follow_up",
            reason: "warm_lead_outside_window",
            parentId: "item-1",
            chainId: "chain-1",
            origin: "live",
            inboundEventId: null,
            queue: true,
            dedupeKey: "send_follow_up:lead_gen:flow-1",
            payload: { subject_type: "lead", subject_id: "lead-1", lead_id: "lead-1" },
        })
    })

    it("does nothing when the proposal omits its draft", async () => {
        const { performer, kit, store } = await build()

        await expect(performer.perform(ctx, itemOf(), { summary: "", fields: {} })).resolves.toEqual({
            summary: "follow.already",
            evidence: "captured",
            lead_id: "lead-1",
            detail: null,
        })

        expect(kit.dm).not.toHaveBeenCalled()
        expect(store.patch).not.toHaveBeenCalled()
    })
})
