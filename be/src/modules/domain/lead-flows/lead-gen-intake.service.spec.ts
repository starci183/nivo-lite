import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import type { BoundAgent } from "@modules/domain/agent-connections"
import type { AgentProfile } from "@modules/domain/agents"
import { CommandBusService } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import type { MetaInboundJob } from "@modules/domain/meta-inbox"
import type { MetaEvent, MetaPageAccess } from "@modules/integrations/meta"
import { LeadAdsIntakeService } from "./lead-ads-intake.service"
import { LeadGenIntakeService } from "./lead-gen-intake.service"
import { LeadFlowConversationService } from "./lead-flow-conversation.service"
import { LeadFlowKitService } from "./lead-flow-kit.service"
import { LeadFlowMetaService } from "./lead-flow-meta.service"
import { LeadFlowStoreService } from "./lead-flow-store.service"
import { EMPTY_SIGNALS } from "./lead-flow-score.policy"
import type { LeadFlow } from "./lead-flows.contracts"

const AT_ISO = "2026-10-12T10:00:00.000Z"
const AT = Date.parse(AT_ISO)
const PAGE: MetaPageAccess = { pageId: "page-1", pageToken: "page-token", igId: null }
const ctx = { workspaceId: "ws-1", actor: "Facebook", locale: "vi" }

const PROFILE: AgentProfile = {
    id: "agent-1",
    name: "Linh",
    handle: "linh",
    role: "Lead gen",
    instructions: "",
    knowledge: "",
    approval_rule: "",
}

const eventOf = builder<MetaEvent>({
    kind: "dm",
    platform: "facebook",
    page_id: "page-1",
    ig_id: null,
    sender_psid: "person-1",
    sender_igsid: null,
    sender_name: "Lan",
    text: " Hello ",
    comment_id: null,
    post_id: null,
    leadgen_id: null,
    form_id: null,
    ad_id: null,
    referral: null,
    postback_payload: null,
    mid: "mid-1",
    timestamp: AT,
    event_key: "dm:mid-1",
})

const agentOf = builder<BoundAgent>({
    id: "agent-1",
    module: "lead_gen",
    name: "Linh",
    access: "auto",
    purpose: "lead_source",
})

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
    asked: 1,
    pending_question: null,
    contact_asked_at: null,
    signals: EMPTY_SIGNALS,
    score: "warm",
    score_reasons: [],
    scored_at: null,
    analysis: null,
    last_user_at: null,
    last_user_text: null,
    greeted_at: AT_ISO,
    handed_off_at: null,
    followed_up_at: null,
    closed_at: null,
    escalated_at: null,
    escalation_reason: null,
})

const jobOf = (event: MetaEvent = eventOf()): MetaInboundJob => ({
    connectionId: "connection-1",
    workspaceId: "ws-1",
    event,
})

const build = async () => {
    const store = mock<LeadFlowStoreService>()
    const meta = mock<LeadFlowMetaService>()
    const transcript = mock<LeadFlowConversationService>()
    const kit = mock<LeadFlowKitService>({ store, meta, transcript })
    kit.text.mockImplementation((_locale, key) => key)
    meta.pageOf.mockResolvedValue(PAGE)
    transcript.leadGenAgent.mockResolvedValue(PROFILE)
    store.candidates.mockResolvedValue([])
    const bindings = mock<AgentBindingsService>()
    bindings.agentsFor.mockResolvedValue([agentOf()])
    bindings.routeInbound.mockResolvedValue({ front: null, handovers: [] })
    const inbound = mock<InboundEventsService>()
    inbound.recordInput.mockResolvedValue({ duplicate: false, inboundEventId: "event-1" })
    const commands = mock<CommandBusService>()
    const leadAds = mock<LeadAdsIntakeService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadGenIntakeService,
            { provide: LeadFlowKitService, useValue: kit },
            { provide: AgentBindingsService, useValue: bindings },
            { provide: InboundEventsService, useValue: inbound },
            { provide: CommandBusService, useValue: commands },
            { provide: LeadAdsIntakeService, useValue: leadAds },
        ],
    }).compile()
    return {
        intake: moduleRef.get(LeadGenIntakeService),
        store,
        transcript,
        bindings,
        inbound,
        commands,
        leadAds,
    }
}

describe("LeadGenIntakeService", () => {
    it("gives a lead form to Lead Ads", async () => {
        const { intake, leadAds, inbound } = await build()
        const form = jobOf(eventOf({ kind: "leadgen", event_key: "leadgen:1" }))

        await expect(intake.take(form)).resolves.toBe(true)

        expect(leadAds.accept).toHaveBeenCalledWith(form)
        expect(inbound.recordInput).not.toHaveBeenCalled()
    })

    it("leaves the event to the chatbot front door when no lead_gen agent listens", async () => {
        const { intake, bindings, commands } = await build()
        bindings.agentsFor.mockResolvedValue([])

        await expect(intake.take(jobOf())).resolves.toBe(false)

        expect(commands.sendCommandItem).not.toHaveBeenCalled()
    })

    it("captures a new person who writes in and marks the event processed", async () => {
        const { intake, inbound, commands } = await build()

        await expect(intake.take(jobOf())).resolves.toBe(true)

        expect(inbound.recordInput).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            channel: "facebook",
            kind: "message",
            origin: "live",
            senderName: "Lan",
            senderContact: null,
            body: "Hello",
            externalRef: "mid-1",
            eventId: "meta:connection-1:dm:mid-1",
        })
        expect(commands.sendCommandItem).toHaveBeenCalledWith(ctx, {
            from: "inbound",
            to: "lead_gen",
            command: "capture_lead",
            reason: "meta_dm",
            origin: "live",
            inboundEventId: "event-1",
            dedupeKey: "capture_lead:inbound:event-1",
            payload: {
                subject_type: "inbound",
                subject_id: "event-1",
                contact_name: "Lan",
                company: "",
                need: "Hello",
                contact: "",
                channel_label: "",
                platform: "facebook",
                source_kind: "dm",
                psid: "person-1",
                igsid: "",
                post_id: "",
                ad_id: "",
                form_id: "",
                comment_id: "",
                referral: "",
                connection_id: "connection-1",
                text: "Hello",
                message_at: AT,
                turn: "t:dm:mid-1",
            },
        })
        expect(inbound.mark).toHaveBeenCalledWith("ws-1", "event-1", "processed", null)
    })

    it("keeps a known person's message and scores the turn", async () => {
        const flow = flowOf()
        const { intake, store, transcript, commands } = await build()
        store.candidates.mockResolvedValue([flow])
        transcript.ensure.mockResolvedValue("conv-1")
        transcript.heldByPerson.mockResolvedValue(false)

        await expect(intake.take(jobOf())).resolves.toBe(true)

        expect(transcript.say).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: "conv-1",
            role: "user",
            body: "Hello",
            delivery: null,
        })
        expect(store.patch).toHaveBeenCalledWith(flow, {
            last_user_at: AT_ISO,
            last_user_text: "Hello",
            conversation_id: "conv-1",
            state: "nurturing",
        })
        expect(commands.sendCommand).toHaveBeenCalledWith(ctx, {
            from: "inbound",
            to: "lead_gen",
            command: "score_lead",
            reason: "customer_turn",
            origin: "live",
            inboundEventId: "event-1",
            dedupeKey: "score_lead:lead-1:t:dm:mid-1",
            payload: {
                subject_type: "lead",
                subject_id: "lead-1",
                lead_id: "lead-1",
                turn: "t:dm:mid-1",
                text: "Hello",
                source_kind: "dm",
                conversation_id: "conv-1",
                connection_id: "connection-1",
            },
        })
        expect(commands.sendCommandItem).not.toHaveBeenCalled()
    })

    it("keeps the message silently while a person holds the conversation", async () => {
        const flow = flowOf({ state: "escalated", resume_state: "qualifying" })
        const { intake, store, transcript, commands } = await build()
        store.candidates.mockResolvedValue([flow])
        transcript.ensure.mockResolvedValue("conv-1")
        transcript.heldByPerson.mockResolvedValue(true)

        await intake.take(jobOf())

        expect(store.patch).toHaveBeenCalledWith(flow, {
            last_user_at: AT_ISO,
            last_user_text: "Hello",
            conversation_id: "conv-1",
        })
        expect(commands.sendCommand).not.toHaveBeenCalled()
    })
})
