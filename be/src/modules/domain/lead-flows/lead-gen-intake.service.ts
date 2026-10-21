import { Injectable } from "@nestjs/common"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { CommandBusService } from "@modules/domain/decisions"
import type { WorkContext } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import type { MetaEventTaker, MetaInboundJob } from "@modules/domain/meta-inbox"
import type { MetaEvent, MetaPageAccess } from "@modules/integrations/meta"
import { LeadAdsIntakeService } from "./lead-ads-intake.service"
import { clip, matchFlow } from "./lead-flow-identity.policy"
import { LeadFlowKitService } from "./lead-flow-kit.service"
import type { AgentProfile } from "@modules/domain/agents"
import type { Identity, LeadFlow, SourceKind } from "./lead-flows.contracts"

/** The flow states a chatbot front door may take back: the prospect is done or with Sales. */
const FRONT_TAKES: ReadonlySet<string> = new Set(["handed_off", "closed"])

/** The language the webhook-started work is written in (the owner's workspace language). */
const LOCALE = "vi"

/** One stored event of a Page that the lead_gen agent takes. */
interface HeardEvent {
    /** The job. */
    readonly job: MetaInboundJob
    /** The lead_gen agent. */
    readonly agent: AgentProfile
    /** The stored inbound event. */
    readonly eventId: string
    /** The person's name. */
    readonly name: string
    /** What they wrote. */
    readonly text: string
}

const identityOf = (event: MetaEvent): Identity => ({
    psid: event.sender_psid,
    igsid: event.sender_igsid,
    phone: null,
    email: null,
})

const kindOf = (event: MetaEvent): SourceKind => {
    if (event.kind === "comment") return "comment"
    if (event.kind === "mention") return "mention"
    return "dm"
}

@Injectable()
/**
 * Facebook and Instagram events that belong to the lead_gen agent, bound to the Meta connection as a `lead_source`:
 *
 *   comment, mention   always lead_gen (no chatbot answers a comment while a lead agent listens)
 *   dm, postback       lead_gen when no chatbot is bound, the person already has a live flow, or came from an ad (referral)
 *   leadgen (a form)   lead_gen capture_lead, else Sales handoff_lead
 *
 * A person with a flow writing in a direct message gets a score_lead turn; anybody else is captured first (create or merge the lead,
 * keep the touch), and the chain scores and answers. Every command carries a key derived from the event, so a redelivery creates nothing.
 */
export class LeadGenIntakeService implements MetaEventTaker {
    constructor(
        private readonly kit: LeadFlowKitService,
        private readonly bindings: AgentBindingsService,
        private readonly inbound: InboundEventsService,
        private readonly commands: CommandBusService,
        private readonly leadAds: LeadAdsIntakeService,
    ) {}

    /** Takes the event when it is the lead flow's; false leaves it to the chatbot front door. */
    async take(job: MetaInboundJob): Promise<boolean> {
        if (job.event.kind === "leadgen") {
            await this.leadAds.accept(job)
            return true
        }
        const agent = await this.leadGenFor(job)
        if (agent === null) return false
        const page = await this.kit.meta.pageOf(job.workspaceId, job.connectionId)
        const text = await this.textOf(job.event, page)
        const name = await this.nameOf(job, page)
        const body = text || (job.event.kind === "dm" ? this.kit.text(LOCALE, "attachment") : "")
        const stored = await this.inbound.recordInput({
            workspaceId: job.workspaceId,
            channel: job.event.platform,
            kind: "message",
            senderName: name,
            senderContact: null,
            body,
            externalRef: job.event.comment_id ?? job.event.mid,
            eventId: `meta:${job.connectionId}:${job.event.event_key}`,
        })
        if (stored.duplicate) {
            const existing = await this.inbound.find(job.workspaceId, stored.inboundEventId)
            if (existing?.status === "processed") return true
        }
        await this.hear({ job, agent, eventId: stored.inboundEventId, name, text })
        await this.inbound.mark(job.workspaceId, stored.inboundEventId, "processed", null)
        return true
    }

    /** The lead_gen agent that should take the event, or null when the chatbot (or nobody) does. */
    private async leadGenFor(job: MetaInboundJob): Promise<AgentProfile | null> {
        const event = job.event
        const [bound] = await this.bindings.agentsFor(job.connectionId, "lead_source", {
            acting: true,
            modules: ["lead_gen"],
        })
        if (bound === undefined) return null
        const agent = await this.kit.transcript.leadGenAgent(job.workspaceId, job.connectionId)
        if (agent === null) return null
        if (event.kind === "comment" || event.kind === "mention") return agent
        if (event.kind !== "dm" && event.kind !== "postback") return null
        const front = (await this.bindings.routeInbound(job.connectionId)).front
        if (front === null) return agent
        const id = identityOf(event)
        const flow = matchFlow(await this.kit.store.candidates(job.workspaceId, id), id, job.connectionId)?.row ?? null
        if (flow !== null) return FRONT_TAKES.has(flow.state) ? null : agent
        return event.referral === null ? null : agent
    }

    private async textOf(event: MetaEvent, page: MetaPageAccess | null): Promise<string> {
        const text = event.text?.trim() ?? ""
        if (event.kind !== "mention" || text !== "" || page === null || event.comment_id === null) return text
        return (await this.kit.meta.mentionOf(page, event.comment_id)).text?.trim() ?? ""
    }

    private async nameOf(job: MetaInboundJob, page: MetaPageAccess | null): Promise<string> {
        const event = job.event
        const person = event.sender_psid ?? event.sender_igsid
        if (event.sender_name !== null) return event.sender_name
        if (event.kind === "mention" && page !== null && event.comment_id !== null) {
            const author = (await this.kit.meta.mentionOf(page, event.comment_id)).username
            if (author !== null) return author
        }
        if (person !== null && page !== null && (event.kind === "dm" || event.kind === "postback")) {
            const name = await this.kit.meta.profileName(page, event.platform, person)
            if (name !== null) return name
        }
        return this.kit.text(LOCALE, `guest.${event.platform}`)
    }

    /** Turns one event into lead_gen work. */
    private async hear(heard: HeardEvent): Promise<void> {
        const { job } = heard
        const event = job.event
        const ctx: WorkContext = {
            workspaceId: job.workspaceId,
            actor: event.platform === "instagram" ? "Instagram" : "Facebook",
            locale: LOCALE,
        }
        const kind = kindOf(event)
        const id = identityOf(event)
        const turn = `t:${event.event_key}`
        const flow =
            kind === "dm" || kind === "comment"
                ? (matchFlow(await this.kit.store.candidates(job.workspaceId, id), id, job.connectionId)?.row ?? null)
                : null
        if (flow?.lead_id != null && kind === "dm") {
            await this.turnOf(ctx, heard, flow, turn)
            return
        }
        // A new person, or a comment / mention (a comment from a known person is a new touch of the same lead).
        await this.commands.sendCommandItem(ctx, {
            from: "inbound",
            to: "lead_gen",
            command: "capture_lead",
            reason: `meta_${kind}`,
            inboundEventId: heard.eventId,
            dedupeKey: `capture_lead:inbound:${heard.eventId}`,
            payload: {
                subject_type: "inbound",
                subject_id: heard.eventId,
                contact_name: heard.name,
                company: "",
                need: clip(heard.text, 300),
                contact: "",
                channel_label: "",
                platform: event.platform,
                source_kind: kind,
                psid: event.sender_psid ?? "",
                igsid: event.sender_igsid ?? "",
                post_id: event.post_id ?? "",
                ad_id: event.ad_id ?? event.referral?.ad_id ?? "",
                form_id: event.form_id ?? "",
                comment_id: event.comment_id ?? "",
                referral: event.referral === null ? "" : JSON.stringify(event.referral),
                connection_id: job.connectionId,
                text: heard.text,
                message_at: event.timestamp,
                turn,
            },
        })
    }

    /** A person with a flow writes again: the message is kept, the window moved, and a score_lead turn runs unless a person holds them. */
    private async turnOf(ctx: WorkContext, heard: HeardEvent, flow: LeadFlow, turn: string): Promise<void> {
        const event = heard.job.event
        const person =
            (event.platform === "instagram" ? (flow.igsid ?? event.sender_igsid) : (flow.psid ?? event.sender_psid)) ??
            ""
        const conversationId =
            person === ""
                ? flow.conversation_id
                : await this.kit.transcript.ensure({
                      workspaceId: ctx.workspaceId,
                      flow,
                      externalId: person,
                      agentId: heard.agent.id,
                  })
        await this.kit.transcript.say({
            workspaceId: ctx.workspaceId,
            conversationId: conversationId ?? flow.conversation_id,
            role: "user",
            body: heard.text || this.kit.text(ctx.locale, "attachment"),
            delivery: null,
        })
        const held = await this.kit.transcript.heldByPerson(flow, conversationId)
        const base = {
            last_user_at: new Date(event.timestamp).toISOString(),
            last_user_text: clip(heard.text, 1000),
            ...(conversationId === null ? {} : { conversation_id: conversationId }),
        }
        if (flow.state === "escalated" && held) {
            // A person has this conversation: silent while they hold it.
            await this.kit.store.patch(flow, base)
            return
        }
        let state = flow.state === "escalated" ? (flow.resume_state ?? "qualifying") : flow.state
        // A lead closed as cold writes again: the conversation reopens (the answers and the question budget are kept).
        if (state === "closed") state = "qualifying"
        await this.kit.store.patch(flow, {
            ...base,
            state,
            ...(flow.state === "escalated" ? { resume_state: null, escalated_at: null, escalation_reason: null } : {}),
            ...(flow.state === "closed" ? { closed_at: null } : {}),
        })
        // Sales or a person already has a handed-over lead: the message is kept, the bot says nothing more.
        if (state === "handed_off") return
        await this.commands.sendCommand(ctx, {
            from: "inbound",
            to: "lead_gen",
            command: "score_lead",
            reason: "customer_turn",
            inboundEventId: heard.eventId,
            dedupeKey: `score_lead:${flow.lead_id ?? flow.id}:${turn}`,
            payload: {
                subject_type: "lead",
                subject_id: flow.lead_id,
                lead_id: flow.lead_id,
                turn,
                text: heard.text,
                source_kind: "dm",
                conversation_id: conversationId ?? flow.conversation_id ?? "",
                connection_id: heard.job.connectionId,
            },
        })
    }
}
