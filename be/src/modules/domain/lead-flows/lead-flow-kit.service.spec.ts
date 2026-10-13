import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock } from "@starci/jest-preset"
import { CommandBusService, EvidenceService, WorkEngineService } from "@modules/domain/decisions"
import type { WorkContext, WorkItem } from "@modules/domain/decisions"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LeadFlowsErrorCode } from "./errors/lead-flows.error"
import { LEAD_GEN_ACTOR, LeadFlowConversationService } from "./lead-flow-conversation.service"
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

const build = async () => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key) => key)
    const store = mock<LeadFlowStoreService>()
    const meta = mock<LeadFlowMetaService>()
    const transcript = mock<LeadFlowConversationService>()
    const engine = mock<WorkEngineService>()
    const commands = mock<CommandBusService>()
    const evidence = mock<EvidenceService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadFlowKitService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LeadFlowStoreService, useValue: store },
            { provide: LeadFlowMetaService, useValue: meta },
            { provide: LeadFlowConversationService, useValue: transcript },
            { provide: WorkEngineService, useValue: engine },
            { provide: CommandBusService, useValue: commands },
            { provide: EvidenceService, useValue: evidence },
        ],
    }).compile()
    return { kit: moduleRef.get(LeadFlowKitService), catalog, store, meta, transcript, engine, commands, evidence }
}

describe("LeadFlowKitService", () => {
    it("reads lead-flow texts, the time and what a step did", async () => {
        const { kit, catalog } = await build()

        expect(kit.text("en", "greet.done", { name: "Lan" })).toBe("lead-flows.greet.done")
        expect(catalog.get).toHaveBeenCalledWith("lead-flows.greet.done", { name: "Lan" }, "en")
        expect(kit.now()).toBe(NOW)
        expect(kit.nameOf(ctx, flowOf({ name: null }))).toBe("lead-flows.customer")
        expect(kit.done("Greeted", flowOf(), "Hello")).toEqual({
            summary: "Greeted",
            evidence: "captured",
            href: "/leads/lead-1",
            lead_id: "lead-1",
            detail: "Hello",
        })
        expect(kit.done("Nothing", null)).toEqual({
            summary: "Nothing",
            evidence: "captured",
            href: "/chat",
            lead_id: null,
            detail: null,
        })
    })

    it("stores a direct message in the transcript with its delivery", async () => {
        const { kit, meta, transcript } = await build()
        meta.sendToFlow.mockResolvedValue({ ok: false, reason: "failed", detail: "token" })

        await expect(kit.dm(ctx, flowOf(), "Hello")).resolves.toEqual({ ok: false, reason: "failed", detail: "token" })

        expect(meta.sendToFlow).toHaveBeenCalledWith("ws-1", flowOf(), "Hello", false)
        expect(transcript.say).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: "conv-1",
            role: "agent",
            body: "Hello",
            delivery: { sent: false, error: "meta_token" },
        })
    })

    it("proposes a tagged reply for a person once the 24 hour window has passed", async () => {
        const { kit, meta, transcript, commands } = await build()
        meta.sendToFlow.mockResolvedValue({ ok: false, reason: "tag_only", detail: null })

        await expect(kit.dmOrExplain(ctx, itemOf(), flowOf(), "Hello", true)).resolves.toEqual({
            sent: false,
            line: "lead-flows.tag.proposed",
        })

        expect(transcript.say).not.toHaveBeenCalled()
        expect(commands.sendCommand).toHaveBeenCalledWith(ctx, {
            from: "lead_gen",
            to: "lead_gen",
            command: "message_with_human_agent_tag",
            reason: "outside_24h",
            parentId: "item-1",
            chainId: "chain-1",
            origin: "live",
            inboundEventId: null,
            queue: true,
            dedupeKey: "message_with_human_agent_tag:item-1",
            payload: {
                subject_type: "lead",
                subject_id: "lead-1",
                lead_id: "lead-1",
                contact: "person-1",
                conversation_id: "conv-1",
            },
            seed: { summary: "lead-flows.tag.summary", draft: "Hello" },
        })
    })

    it("explains a message that could not go and refuses a Meta failure", async () => {
        const { kit, meta, commands } = await build()
        meta.sendToFlow.mockResolvedValueOnce({ ok: false, reason: "no_recipient", detail: null })
        meta.sendToFlow.mockResolvedValueOnce({ ok: false, reason: "failed", detail: "token" })

        await expect(kit.dmOrExplain(ctx, itemOf(), flowOf(), "Hello", true)).resolves.toEqual({
            sent: false,
            line: "lead-flows.not-sent.no-recipient",
        })
        await expect(kit.dmOrExplain(ctx, itemOf(), flowOf(), "Hello", true)).rejects.toMatchObject({
            code: LeadFlowsErrorCode.MetaRefused,
        })

        expect(commands.sendCommand).not.toHaveBeenCalled()
    })

    it("holds the prospect for a person, silences the bot and tells the person once", async () => {
        const { kit, store, meta, transcript, evidence } = await build()
        const flow = flowOf({ state: "qualifying" })
        const held = flowOf({ state: "escalated" })
        store.patch.mockResolvedValue(held)
        meta.sendToFlow.mockResolvedValue({ ok: true, reason: null, detail: null })

        await expect(
            kit.holdForPerson(ctx, { flow, reason: "refund", itemId: "item-9", question: "Money back", notify: true }),
        ).resolves.toBe(held)

        expect(store.patch).toHaveBeenCalledWith(flow, {
            state: "escalated",
            resume_state: "qualifying",
            escalated_at: NOW,
            escalation_reason: "refund",
        })
        expect(transcript.handToPerson).toHaveBeenCalledWith("ws-1", "conv-1")
        expect(evidence.log).toHaveBeenCalledWith(ctx, {
            lead_id: "lead-1",
            work_item_id: "item-9",
            kind: "lead_gen.escalated",
            actor: LEAD_GEN_ACTOR,
            summary: "lead-flows.escalate.evidence",
            evidence: "Money back",
        })
        expect(meta.sendToFlow).toHaveBeenCalledWith("ws-1", held, "lead-flows.line.handover", false)
    })
})
