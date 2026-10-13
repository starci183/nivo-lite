import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { WORK_PERFORMER_REGISTRY } from "@modules/domain/decisions"
import type { WorkContext, WorkItem, WorkPerformerRegistry } from "@modules/domain/decisions"
import { GreetProspectPerformerService } from "./greet-prospect-performer.service"
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
    const kit = mock<LeadFlowKitService>({
        store,
        meta: mock<LeadFlowMetaService>(),
        transcript: mock<LeadFlowConversationService>(),
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
    store.requireByLead.mockResolvedValue(flow)
    const moduleRef = await Test.createTestingModule({
        providers: [
            GreetProspectPerformerService,
            { provide: WORK_PERFORMER_REGISTRY, useValue: registry },
            { provide: LeadFlowKitService, useValue: kit },
        ],
    }).compile()
    return { performer: moduleRef.get(GreetProspectPerformerService), registry, kit, store }
}

describe("GreetProspectPerformerService", () => {
    it("registers greet_prospect at boot", async () => {
        const { performer, registry } = await build()

        performer.onModuleInit()

        expect(registry.add).toHaveBeenCalledWith("greet_prospect", performer)
    })

    it("drafts the reply of the turn, else the named greeting", async () => {
        const { performer, kit } = await build()
        const withReply = itemOf({ proposal: { summary: "", fields: { reply: "Hi Lan, welcome" } } })

        await expect(performer.prepare(ctx, withReply)).resolves.toEqual({
            proposal: { summary: "greet.summary", fields: { reply: "Hi Lan, welcome" }, draft: "Hi Lan, welcome" },
        })
        await expect(performer.prepare(ctx, itemOf())).resolves.toEqual({
            proposal: { summary: "greet.summary", fields: {}, draft: "line.greet-named" },
        })

        expect(kit.text).toHaveBeenCalledWith("en", "line.greet-named", { name: "Lan" })
    })

    it("greets inside the window and marks the flow greeted", async () => {
        const { performer, kit, store } = await build()
        kit.dmOrExplain.mockResolvedValue({ sent: true, line: "" })

        await expect(performer.perform(ctx, itemOf(), { summary: "", fields: {}, draft: "Hello" })).resolves.toEqual({
            summary: "greet.done",
            evidence: "captured",
            lead_id: "lead-1",
            detail: "Hello",
        })

        expect(kit.dmOrExplain).toHaveBeenCalledWith(ctx, itemOf(), flowOf(), "Hello", true)
        expect(store.patch).toHaveBeenCalledWith(flowOf(), { state: "greeted", greeted_at: NOW })
    })

    it("explains a greeting that could not go and never greets twice", async () => {
        const { performer, kit, store } = await build()
        kit.dmOrExplain.mockResolvedValue({ sent: false, line: "not-sent.window" })

        await expect(
            performer.perform(ctx, itemOf(), { summary: "", fields: {}, draft: "Hello" }),
        ).resolves.toMatchObject({
            summary: "not-sent.window",
        })
        store.requireByLead.mockResolvedValue(flowOf({ greeted_at: NOW }))
        await expect(
            performer.perform(ctx, itemOf(), { summary: "", fields: {}, draft: "Hello" }),
        ).resolves.toMatchObject({
            summary: "greet.already",
        })

        expect(kit.dmOrExplain).toHaveBeenCalledTimes(1)
        expect(store.patch).not.toHaveBeenCalled()
    })
})
