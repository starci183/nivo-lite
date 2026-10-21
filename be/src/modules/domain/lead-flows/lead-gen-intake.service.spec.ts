import {
    AT_ISO,
    AT,
    PAGE,
    ctx,
    PROFILE,
    eventOf,
    agentOf,
    flowOf,
    jobOf,
} from "../../../tests/fixtures/builders/lead-gen-intake.builder"
import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { CommandBusService } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import type { MetaEvent } from "@modules/integrations/meta"
import { LeadAdsIntakeService } from "./lead-ads-intake.service"
import { LeadGenIntakeService } from "./lead-gen-intake.service"
import { LeadFlowConversationService } from "./lead-flow-conversation.service"
import { LeadFlowKitService } from "./lead-flow-kit.service"
import { LeadFlowMetaService } from "./lead-flow-meta.service"
import { LeadFlowStoreService } from "./lead-flow-store.service"
import type { FlowState, LeadFlow, LeadFlowPatch, MentionRead } from "./lead-flows.contracts"

type InboundEvent = NonNullable<Awaited<ReturnType<InboundEventsService["find"]>>>

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
    const intake = moduleRef.get(LeadGenIntakeService)
    return { intake, store, transcript, bindings, inbound, commands, leadAds, meta }
}

const mention = builder<MetaEvent>(
    eventOf({
        kind: "mention",
        platform: "instagram",
        sender_psid: null,
        sender_igsid: "ig-1",
        sender_name: null,
        text: null,
        comment_id: "mention-1",
    }),
)

const nameless = builder<MetaEvent>(eventOf({ sender_name: null, text: null }))

const emptyRead: MentionRead = { text: null, username: null }

const read: MentionRead = { text: "  Details  ", username: "ada" }

type EventCase = readonly [MetaEvent, boolean, MentionRead, string | null, string, string, number]

const resumed = (state: FlowState): LeadFlowPatch => ({
    state,
    resume_state: null,
    escalated_at: null,
    escalation_reason: null,
})

const turnCase = builder<{
    flow: LeadFlow
    event: MetaEvent
    ensured: string | null
    person: string | null
    patch: LeadFlowPatch
    text: string
}>({
    flow: flowOf(),
    event: eventOf(),
    ensured: "conv-1",
    person: "person-1",
    patch: { state: "nurturing", conversation_id: "conv-1" },
    text: "Hello",
})
const turnCases = [
    turnCase({
        flow: flowOf({ state: "escalated", resume_state: "scored" }),
        patch: { ...resumed("scored"), conversation_id: "conv-1" },
    }),
    turnCase({
        flow: flowOf({ state: "escalated" }),
        patch: { ...resumed("qualifying"), conversation_id: "conv-1" },
    }),
    turnCase({
        flow: flowOf({ state: "closed", closed_at: AT_ISO }),
        patch: { state: "qualifying", conversation_id: "conv-1", closed_at: null },
    }),
    turnCase({
        flow: flowOf({ state: "handed_off" }),
        patch: { state: "handed_off", conversation_id: "conv-1" },
    }),
    turnCase({
        flow: flowOf({ platform: "instagram", igsid: "ig-1" }),
        event: eventOf({ platform: "instagram", sender_igsid: "ig-1" }),
        person: "ig-1",
    }),
    turnCase({
        flow: flowOf({ platform: "instagram" }),
        event: eventOf({ platform: "instagram", sender_igsid: "ig-2", text: null }),
        person: "ig-2",
        text: "",
    }),
    turnCase({ flow: flowOf({ psid: null, igsid: "ig-1" }), event: eventOf({ sender_igsid: "ig-1" }) }),
    turnCase({
        flow: flowOf({ platform: "instagram", conversation_id: null }),
        event: eventOf({ platform: "instagram" }),
        person: null,
        patch: { state: "nurturing" },
    }),
    turnCase({
        ensured: null,
        patch: { state: "nurturing" },
        event: eventOf({ text: "x".repeat(1005) }),
        text: "x".repeat(1005),
    }),
]

describe("LeadGenIntakeService", () => {
    it("gives a lead form to Lead Ads and rejects it from direct-message routing", async () => {
        const { intake, leadAds, inbound, bindings } = await build()
        const form = jobOf(eventOf({ kind: "leadgen", event_key: "leadgen:1" }))

        await expect(intake.take(form)).resolves.toBe(true)

        expect(leadAds.accept).toHaveBeenCalledWith(form)
        expect(inbound.recordInput).not.toHaveBeenCalled()
        await expect(intake["leadGenFor"](form)).resolves.toBeNull()
        expect(bindings.routeInbound).not.toHaveBeenCalled()
    })
    it("leaves the event to the chatbot front door when no lead_gen agent listens", async () => {
        const { intake, bindings, commands } = await build()
        bindings.agentsFor.mockResolvedValue([])

        await expect(intake.take(jobOf())).resolves.toBe(false)

        expect(commands.sendCommandItem).not.toHaveBeenCalled()
    })
})

describe("LeadGenIntakeService", () => {
    it("captures a new person who writes in and marks the event processed", async () => {
        const { intake, inbound, commands } = await build()

        await expect(intake.take(jobOf())).resolves.toBe(true)

        expect(inbound.recordInput).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            channel: "facebook",
            kind: "message",
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
})

describe("LeadGenIntakeService", () => {
    it.each<readonly [boolean, string | null, string]>([
        [false, "lead-1", "score_lead:lead-1:t:dm:mid-1"],
        [false, null, "score_lead:flow-1:t:dm:mid-1"],
        [true, "lead-1", ""],
    ])("keeps a known turn held=%s lead=%s", async (held, leadId, dedupeKey) => {
        const flow = held
            ? flowOf({ lead_id: leadId, state: "escalated", resume_state: "qualifying" })
            : flowOf({ lead_id: leadId })
        const { intake, store, transcript, commands } = await build()
        store.candidates.mockResolvedValue([flow])
        transcript.ensure.mockResolvedValue("conv-1")
        transcript.heldByPerson.mockResolvedValue(held)

        if (leadId === null)
            await expect(
                intake["turnOf"](
                    ctx,
                    { job: jobOf(), agent: PROFILE, eventId: "event-1", name: "Lan", text: "Hello" },
                    flow,
                    "t:dm:mid-1",
                ),
            ).resolves.toBeUndefined()
        else await expect(intake.take(jobOf())).resolves.toBe(true)

        expect(store.patch).toHaveBeenCalledWith(flow, {
            last_user_at: AT_ISO,
            last_user_text: "Hello",
            conversation_id: "conv-1",
            ...(held ? {} : { state: "nurturing" }),
        })
        if (held) {
            expect(commands.sendCommand).not.toHaveBeenCalled()
            return
        }

        expect(transcript.say).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: "conv-1",
            role: "user",
            body: "Hello",
            delivery: null,
        })
        expect(commands.sendCommand).toHaveBeenCalledWith(ctx, {
            from: "inbound",
            to: "lead_gen",
            command: "score_lead",
            reason: "customer_turn",
            inboundEventId: "event-1",
            dedupeKey,
            payload: {
                subject_type: "lead",
                subject_id: leadId,
                lead_id: leadId,
                turn: "t:dm:mid-1",
                text: "Hello",
                source_kind: "dm",
                conversation_id: "conv-1",
                connection_id: "connection-1",
            },
        })
        expect(commands.sendCommandItem).not.toHaveBeenCalled()
    })
})

describe("LeadGenIntakeService", () => {
    it.each<Array<readonly [boolean, boolean, FlowState | null, boolean, boolean]>[number]>([
        [false, true, null, false, false],
        [true, false, null, false, false],
        [true, true, "closed", false, false],
        [true, true, "handed_off", false, false],
        [true, true, "nurturing", false, true],
        [true, true, null, false, false],
        [true, true, null, true, true],
    ])("routes lead intake case %#", async (bound, loaded, state, referred, accepted) => {
        const { intake, bindings, transcript, store, inbound, commands } = await build()
        bindings.agentsFor.mockResolvedValue(bound ? [agentOf()] : [])
        transcript.leadGenAgent.mockResolvedValue(loaded ? PROFILE : null)
        bindings.routeInbound.mockResolvedValue({ front: agentOf({ module: "chatbot" }), handovers: [] })
        store.candidates.mockResolvedValue(state === null ? [] : [flowOf({ state })])
        transcript.ensure.mockResolvedValue("conv-1")
        const referral = referred ? { ref: "offer", source: "ADS", type: "OPEN_THREAD", ad_id: "ad-7" } : null

        await expect(intake.take(jobOf(eventOf({ kind: referred ? "postback" : "dm", referral })))).resolves.toBe(
            accepted,
        )

        expect(inbound.recordInput).toHaveBeenCalledTimes(accepted ? 1 : 0)
        expect(bindings.agentsFor).toHaveBeenCalledWith("connection-1", "lead_source", {
            acting: true,
            modules: ["lead_gen"],
        })
        if (referred)
            expect(commands.sendCommandItem.mock.calls[0]?.[1].payload).toMatchObject({
                ad_id: "ad-7",
                referral: JSON.stringify(referral),
            })
    })
    it.each(["processed", "received", null])("handles a duplicate stored as %s", async (status) => {
        const { intake, inbound, commands } = await build()
        inbound.recordInput.mockResolvedValue({ duplicate: true, inboundEventId: "event-1" })
        const existing = mock<InboundEvent>({ status: status ?? "received" })
        inbound.find.mockResolvedValue(status === null ? null : existing)

        await expect(intake.take(jobOf())).resolves.toBe(true)

        expect(inbound.find).toHaveBeenCalledWith("ws-1", "event-1")
        expect(commands.sendCommandItem).toHaveBeenCalledTimes(status === "processed" ? 0 : 1)
        expect(inbound.mark).toHaveBeenCalledTimes(status === "processed" ? 0 : 1)
        if (status !== "processed") expect(inbound.mark).toHaveBeenCalledWith("ws-1", "event-1", "processed", null)
    })
})

describe("LeadGenIntakeService", () => {
    it.each<EventCase>([
        [mention(), true, read, null, "Details", "ada", 2],
        [mention(), true, emptyRead, null, "", "guest.instagram", 2],
        [mention({ text: "  Supplied  ", sender_name: "Lan" }), true, emptyRead, null, "Supplied", "Lan", 0],
        [mention(), false, emptyRead, null, "", "guest.instagram", 0],
        [mention({ comment_id: null }), true, emptyRead, null, "", "guest.instagram", 0],
        [nameless({ text: " Hello " }), true, emptyRead, "Profile Lan", "Hello", "Profile Lan", 0],
        [
            nameless({ kind: "postback", platform: "instagram", sender_psid: null, sender_igsid: "ig-8" }),
            true,
            emptyRead,
            null,
            "",
            "guest.instagram",
            0,
        ],
        [nameless({ sender_psid: null }), true, emptyRead, null, "attachment", "guest.facebook", 0],
        [nameless(), false, emptyRead, null, "attachment", "guest.facebook", 0],
        [nameless({ kind: "comment" }), true, emptyRead, null, "", "guest.facebook", 0],
    ])("captures %j with Page=%s and hydration=%j", async (event, connected, hydrated, profile, body, name, reads) => {
        const { intake, meta, inbound, commands } = await build()
        meta.pageOf.mockResolvedValue(connected ? PAGE : null)
        meta.mentionOf.mockResolvedValue(hydrated)
        meta.profileName.mockResolvedValue(profile)

        await expect(intake.take(jobOf(event))).resolves.toBe(true)

        expect(meta.mentionOf).toHaveBeenCalledTimes(reads)
        if (reads > 0) expect(meta.mentionOf).toHaveBeenCalledWith(PAGE, "mention-1")
        if (profile !== null) expect(meta.profileName).toHaveBeenCalledWith(PAGE, "facebook", "person-1")
        expect(inbound.recordInput).toHaveBeenCalledWith(
            expect.objectContaining({ senderName: name, body, externalRef: event.comment_id ?? event.mid }),
        )
        expect(commands.sendCommandItem.mock.calls[0]?.[1].payload).toMatchObject({
            contact_name: name,
            text: body === "attachment" ? "" : body,
            source_kind: event.kind === "postback" ? "dm" : event.kind,
        })
    })
    it("captures a known comment or leadless flow with exact touch fields and clipped need", async () => {
        const { intake, store, commands } = await build()
        const referral = { ref: "offer", source: "ADS", type: "OPEN_THREAD", ad_id: "referred-ad" }
        const text = "x".repeat(305)
        const fields = { text, comment_id: "comment-4", post_id: "post-2", ad_id: "ad-9", form_id: "form-6" }
        for (const kind of ["comment", "dm"] as const) {
            store.candidates.mockResolvedValue([flowOf({ lead_id: kind === "dm" ? null : "lead-1" })])
            await expect(intake.take(jobOf(eventOf({ kind, ...fields, referral })))).resolves.toBe(true)
            expect(commands.sendCommandItem).toHaveBeenLastCalledWith(
                ctx,
                expect.objectContaining({
                    reason: `meta_${kind}`,
                    payload: expect.objectContaining({
                        ...fields,
                        need: `${"x".repeat(299)}\u2026`,
                        source_kind: kind,
                        referral: JSON.stringify(referral),
                    }),
                }),
            )
        }
        expect(commands.sendCommand).not.toHaveBeenCalled()
    })
})

describe("LeadGenIntakeService", () => {
    it.each(turnCases)("keeps the existing lead turn %j", async ({ flow, event, ensured, person, patch, text }) => {
        const { intake, store, transcript, commands } = await build()
        const conversationId = person === null ? flow.conversation_id : (ensured ?? flow.conversation_id)
        const scored = patch.state !== "handed_off"
        store.candidates.mockResolvedValue([flow])
        transcript.ensure.mockResolvedValue(ensured)
        transcript.heldByPerson.mockResolvedValue(false)

        await expect(intake.take(jobOf(event))).resolves.toBe(true)

        expect(transcript.ensure).toHaveBeenCalledTimes(person === null ? 0 : 1)
        if (person !== null)
            expect(transcript.ensure).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                flow,
                externalId: person,
                agentId: "agent-1",
            })
        expect(transcript.say).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId,
            role: "user",
            body: text || "attachment",
            delivery: null,
        })
        expect(store.patch).toHaveBeenCalledWith(flow, {
            last_user_at: AT_ISO,
            last_user_text: text.length > 1000 ? `${"x".repeat(999)}\u2026` : text,
            ...patch,
        })
        expect(commands.sendCommand).toHaveBeenCalledTimes(scored ? 1 : 0)
        if (scored) {
            const command = commands.sendCommand.mock.calls[0]
            expect(command?.[0]).toEqual({ ...ctx, actor: event.platform === "instagram" ? "Instagram" : "Facebook" })
            expect(command?.[1].payload).toMatchObject({ conversation_id: conversationId ?? "", text })
        }
    })
})
