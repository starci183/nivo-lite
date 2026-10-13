import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { WORK_PERFORMER_REGISTRY } from "@modules/domain/decisions"
import type { WorkContext, WorkItem, WorkPerformerRegistry } from "@modules/domain/decisions"
import { LeadFlowsError, LeadFlowsErrorCode } from "./errors/lead-flows.error"
import { HumanAgentTagPerformerService } from "./human-agent-tag-performer.service"
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

const build = async (flow: LeadFlow = flowOf()) => {
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
    const moduleRef = await Test.createTestingModule({
        providers: [
            HumanAgentTagPerformerService,
            { provide: WORK_PERFORMER_REGISTRY, useValue: registry },
            { provide: LeadFlowKitService, useValue: kit },
        ],
    }).compile()
    return { performer: moduleRef.get(HumanAgentTagPerformerService), registry, kit }
}

const proposal = { summary: "tag.summary", fields: {}, draft: "Sorry for the wait" }

describe("HumanAgentTagPerformerService", () => {
    it("registers message_with_human_agent_tag at boot and keeps the proposal the step carried", async () => {
        const { performer, registry } = await build()
        const item = itemOf({ proposal })

        performer.onModuleInit()

        expect(registry.add).toHaveBeenCalledWith("message_with_human_agent_tag", performer)
        await expect(performer.prepare(ctx, item)).resolves.toEqual({ proposal })
    })

    it("sends the approved text with the human agent tag", async () => {
        const { performer, kit } = await build()
        kit.dm.mockResolvedValue({ ok: true, reason: null, detail: null })

        await expect(performer.perform(ctx, itemOf(), proposal)).resolves.toEqual({
            summary: "tag.done",
            evidence: "captured",
            lead_id: "lead-1",
            detail: "Sorry for the wait",
        })

        expect(kit.dm).toHaveBeenCalledWith(ctx, flowOf(), "Sorry for the wait", true)
    })

    it("refuses once even the tagged window has closed", async () => {
        const { performer, kit } = await build()
        kit.dm.mockResolvedValue({ ok: false, reason: "window", detail: null })

        await expect(performer.perform(ctx, itemOf(), proposal)).rejects.toEqual(
            new LeadFlowsError({ code: LeadFlowsErrorCode.WindowClosed }),
        )
    })

    it("refuses any other refusal as a Meta refusal", async () => {
        const { performer, kit } = await build()
        kit.dm.mockResolvedValue({ ok: false, reason: "not_connected", detail: null })

        await expect(performer.perform(ctx, itemOf(), proposal)).rejects.toMatchObject({
            code: LeadFlowsErrorCode.MetaRefused,
        })

        expect(kit.metaRefused).toHaveBeenCalledWith("not_connected")
    })
})
