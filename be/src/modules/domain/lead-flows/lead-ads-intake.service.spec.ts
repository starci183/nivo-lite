import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import type { BoundAgent } from "@modules/domain/agent-connections"
import { ConnectionsService } from "@modules/domain/connections"
import { CommandBusService, WorkEngineService } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import type { MetaInboundJob } from "@modules/domain/meta-inbox"
import { MetaError, MetaErrorCode } from "@modules/integrations/meta"
import type { MetaEvent, MetaLead, MetaPageAccess } from "@modules/integrations/meta"
import { LeadAdsIntakeService } from "./lead-ads-intake.service"
import { LeadFlowConversationService } from "./lead-flow-conversation.service"
import { LeadFlowKitService } from "./lead-flow-kit.service"
import { LeadFlowMetaService } from "./lead-flow-meta.service"
import { LeadFlowStoreService } from "./lead-flow-store.service"

const AT = Date.parse("2026-10-12T10:00:00.000Z")
const ctx = { workspaceId: "ws-1", actor: "Facebook Lead Ads", locale: "vi" }
const PAGE: MetaPageAccess = { pageId: "page-1", pageToken: "page-token", igId: null }

const eventOf = builder<MetaEvent>({
    kind: "leadgen",
    platform: "facebook",
    page_id: "page-1",
    ig_id: null,
    sender_psid: null,
    sender_igsid: null,
    sender_name: null,
    text: null,
    comment_id: null,
    post_id: null,
    leadgen_id: "leadgen-1",
    form_id: "form-1",
    ad_id: null,
    referral: null,
    postback_payload: null,
    mid: null,
    timestamp: AT,
    event_key: "leadgen:leadgen-1",
})

const LEAD: MetaLead = {
    name: "Lan",
    phone: "+84912345678",
    email: null,
    fields: { full_name: "Lan", phone_number: "+84912345678", budget_range: "10m" },
    ad_id: null,
    form_id: "form-1",
    created_at: null,
}

const agentOf = builder<BoundAgent>({
    id: "agent-1",
    module: "lead_gen",
    name: "Linh",
    access: "auto",
    purpose: "lead_source",
})

const job: MetaInboundJob = { connectionId: "connection-1", workspaceId: "ws-1", event: eventOf() }

const build = async () => {
    const meta = mock<LeadFlowMetaService>()
    const kit = mock<LeadFlowKitService>({
        store: mock<LeadFlowStoreService>(),
        meta,
        transcript: mock<LeadFlowConversationService>(),
    })
    kit.text.mockImplementation((_locale, key) => key)
    meta.pageOf.mockResolvedValue(PAGE)
    meta.fetchLead.mockResolvedValue(LEAD)
    const bindings = mock<AgentBindingsService>()
    const connections = mock<ConnectionsService>()
    const inbound = mock<InboundEventsService>()
    inbound.recordInput.mockResolvedValue({ duplicate: false, inboundEventId: "event-1" })
    const commands = mock<CommandBusService>()
    const engine = mock<WorkEngineService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadAdsIntakeService,
            { provide: LeadFlowKitService, useValue: kit },
            { provide: AgentBindingsService, useValue: bindings },
            { provide: ConnectionsService, useValue: connections },
            { provide: InboundEventsService, useValue: inbound },
            { provide: CommandBusService, useValue: commands },
            { provide: WorkEngineService, useValue: engine },
        ],
    }).compile()
    return { intake: moduleRef.get(LeadAdsIntakeService), meta, bindings, connections, inbound, commands, engine }
}

const NEED = "channel.lead-ads (lead-ads.form)\nbudget range: 10m"

describe("LeadAdsIntakeService", () => {
    it("stores the submission and has the lead_gen agent capture it", async () => {
        const { intake, meta, bindings, inbound, commands, engine } = await build()
        bindings.agentsFor.mockResolvedValue([agentOf()])

        await expect(intake.accept(job)).resolves.toBeUndefined()

        expect(meta.fetchLead).toHaveBeenCalledWith(PAGE, "leadgen-1")
        expect(inbound.recordInput).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            channel: "facebook",
            kind: "lead",
            origin: "live",
            senderName: "Lan",
            senderContact: "+84912345678",
            body: NEED,
            externalRef: "leadgen-1",
            eventId: "meta:connection-1:leadgen:leadgen-1",
        })
        expect(commands.sendCommandItem).toHaveBeenCalledWith(ctx, {
            from: "inbound",
            to: "lead_gen",
            command: "capture_lead",
            reason: "lead_ad",
            origin: "live",
            inboundEventId: "event-1",
            dedupeKey: "capture_lead:inbound:event-1",
            payload: {
                subject_type: "inbound",
                subject_id: "event-1",
                contact_name: "Lan",
                company: "",
                need: NEED,
                contact: "+84912345678",
                channel_label: "channel.lead-ads",
                platform: "facebook",
                source_kind: "leadgen",
                form_id: "form-1",
                ad_id: "",
                leadgen_id: "leadgen-1",
                connection_id: "connection-1",
                phone: "+84912345678",
                email: "",
                turn: "t:leadgen:leadgen-1",
                message_at: AT,
                text: "budget range: 10m",
            },
        })
        expect(engine.runWork).not.toHaveBeenCalled()
        expect(inbound.mark).toHaveBeenCalledWith("ws-1", "event-1", "processed", null)
    })

    it("hands the submission to Sales when no lead_gen agent listens", async () => {
        const { intake, bindings, commands, engine } = await build()
        bindings.agentsFor.mockResolvedValue([agentOf({ module: "sales" })])

        await intake.accept(job)

        expect(commands.sendCommandItem).not.toHaveBeenCalled()
        expect(engine.runWork).toHaveBeenCalledWith(ctx, {
            action: "handoff_lead",
            subject_type: "inbound",
            subject_id: "event-1",
            inbound_event_id: "event-1",
            origin: "live",
            dedupeKey: "handoff_lead:inbound:event-1",
            seed: {
                fields: {
                    contact_name: "Lan",
                    company: "",
                    need: NEED,
                    contact: "+84912345678",
                    channel_label: "channel.lead-ads",
                },
            },
        })
    })

    it("marks the connection failing on a lasting refusal and routes nothing", async () => {
        const { intake, meta, bindings, connections, inbound } = await build()
        meta.fetchLead.mockRejectedValue(new MetaError({ code: MetaErrorCode.Refused, params: { failure: "token" } }))

        await expect(intake.accept(job)).resolves.toBeUndefined()

        expect(connections.markFailing).toHaveBeenCalledWith("connection-1", "lead-ads.refused")
        expect(inbound.recordInput).toHaveBeenCalledWith(
            expect.objectContaining({ senderName: "guest.facebook", senderContact: null, body: "lead-ads.unreadable" }),
        )
        expect(bindings.agentsFor).not.toHaveBeenCalled()
        expect(inbound.mark).not.toHaveBeenCalled()
    })

    it("rethrows a refusal that may heal on a retry", async () => {
        const { intake, meta, inbound } = await build()
        const failure = new MetaError({ code: MetaErrorCode.Refused, params: { failure: "rate_limited" } })
        meta.fetchLead.mockRejectedValue(failure)

        await expect(intake.accept(job)).rejects.toBe(failure)

        expect(inbound.recordInput).not.toHaveBeenCalled()
    })
})
