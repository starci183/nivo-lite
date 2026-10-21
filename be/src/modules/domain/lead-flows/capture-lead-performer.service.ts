import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { BusinessEventsService } from "@modules/domain/automations"
import { InjectWorkPerformerRegistry } from "@modules/domain/decisions"
import type {
    Performed,
    Prepared,
    Proposal,
    WorkContext,
    WorkItem,
    WorkPerformer,
    WorkPerformerRegistry,
} from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { LeadRecordsService } from "@modules/domain/leads"
import type { LeadRecordRow } from "@modules/domain/leads"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { LeadFlowsError, LeadFlowsErrorCode } from "./errors/lead-flows.error"
import { channelKeyOf, field, identityOf, sourceOf } from "./lead-flow-fields.policy"
import type { FlowFields } from "./lead-flow-fields.policy"
import { addTouch, clip, identityPatch, matchFlow } from "./lead-flow-identity.policy"
import { LeadFlowKitService } from "./lead-flow-kit.service"
import type { Identity, LeadFlow, LeadFlowPatch, LeadSource } from "./lead-flows.contracts"

/** The lead a capture found or created. */
interface FoundLead {
    /** The lead. */
    readonly lead: LeadRecordRow
    /** It was already known. */
    readonly matched: boolean
}

@Injectable()
/** `capture_lead`: creates or merges the lead (Messenger / Instagram id, phone, email), keeps the touch, and opens the flow and its transcript. */
export class CaptureLeadPerformerService implements WorkPerformer, OnModuleInit {
    constructor(
        @InjectWorkPerformerRegistry() private readonly registry: WorkPerformerRegistry,
        private readonly kit: LeadFlowKitService,
        private readonly leads: LeadRecordsService,
        private readonly inbound: InboundEventsService,
        private readonly responsibilities: ResponsibilityJournalService,
        private readonly events: BusinessEventsService,
    ) {}

    /** Registers the performer with the work engine. */
    onModuleInit(): void {
        this.registry.add("capture_lead", this)
    }

    /** The summary the owner reads. */
    prepare(ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        const fields = item.proposal.fields
        const source = sourceOf(fields, this.kit.now())
        const name = field(fields, "contact_name") || this.kit.text(ctx.locale, `guest.${source.platform}`)
        const summary = this.kit.text(ctx.locale, "capture.summary", {
            name,
            source: this.kit.sourceLine(ctx.locale, source),
        })
        return Promise.resolve({ proposal: { ...item.proposal, summary } })
    }

    /** Finds or creates the lead, opens or updates the flow, and starts the transcript of a message or a comment. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal): Promise<Performed> {
        const fields = proposal.fields
        const source = sourceOf(fields, this.kit.now())
        const id = identityOf(fields)
        const connectionId = field(fields, "connection_id") || null
        const candidates = await this.kit.store.candidates(ctx.workspaceId, id)
        const hit = matchFlow(candidates, id, connectionId)?.row ?? null
        const found = await this.leadOf(ctx, item, fields, source, id, hit)
        let flow = hit ?? (await this.kit.store.byLead(ctx.workspaceId, found.lead.id))
        flow ??= await this.open(ctx, found.lead.id, fields, source, id)
        flow = await this.kit.store.patch(flow, this.touchPatch(flow, found.lead.id, fields, source, id))
        flow = await this.startTranscript(ctx, flow, source, field(fields, "text"))
        if (item.inbound_event_id !== null)
            await this.inbound.mark(ctx.workspaceId, item.inbound_event_id, null, found.lead.id)
        const params = { name: found.lead.contact_name, source: this.kit.sourceLine(ctx.locale, source) }
        return this.kit.done(this.kit.text(ctx.locale, found.matched ? "capture.merged" : "capture.done", params), flow)
    }

    private async leadOf(
        ctx: WorkContext,
        item: WorkItem,
        fields: FlowFields,
        source: LeadSource,
        id: Identity,
        flow: LeadFlow | null,
    ): Promise<FoundLead> {
        const text = field(fields, "text")
        const sourceLine = this.kit.sourceLine(ctx.locale, source)
        const byFlow = flow?.lead_id == null ? null : await this.leads.find(ctx.workspaceId, flow.lead_id)
        const known =
            byFlow ??
            (id.phone === null && id.email === null
                ? null
                : await this.leads.match({
                      workspaceId: ctx.workspaceId,
                      phone: id.phone,
                      email: id.email,
                      name: null,
                      channel: null,
                  }))
        if (known !== null) {
            if ((id.phone !== null && known.phone === null) || (id.email !== null && known.email === null))
                await this.leads.fillContact({
                    workspaceId: ctx.workspaceId,
                    leadId: known.id,
                    phone: id.phone,
                    email: id.email,
                })
            await this.logLead(
                ctx,
                item,
                known.id,
                "lead.touch",
                this.kit.text(ctx.locale, "capture.touch", { source: sourceLine }),
                text,
            )
            return { lead: known, matched: true }
        }
        const lead = await this.leads.capture({
            workspaceId: ctx.workspaceId,
            contactName: field(fields, "contact_name") || this.kit.text(ctx.locale, `guest.${source.platform}`),
            company: field(fields, "company") || this.kit.text(ctx.locale, "not-shared"),
            channel: field(fields, "channel_label") || this.kit.text(ctx.locale, `channel.${channelKeyOf(source)}`),
            need: field(fields, "need") || clip(text, 300) || sourceLine,
            phone: id.phone,
            email: id.email,
        })
        await this.responsibilities.ensureFor(ctx, lead.id)
        await this.events.leadCreated(ctx.workspaceId, lead)
        await this.logLead(
            ctx,
            item,
            lead.id,
            "lead.captured",
            this.kit.text(ctx.locale, "capture.created", { source: sourceLine }),
            text || lead.need,
        )
        return { lead, matched: false }
    }

    private async logLead(
        ctx: WorkContext,
        item: WorkItem,
        leadId: string,
        kind: string,
        summary: string,
        evidence: string,
    ): Promise<void> {
        await this.kit.log(ctx, { lead_id: leadId }, item.id, kind, summary, evidence)
    }

    private async open(
        ctx: WorkContext,
        leadId: string,
        fields: FlowFields,
        source: LeadSource,
        id: Identity,
    ): Promise<LeadFlow> {
        const isMessage = source.kind === "dm"
        const opened = await this.kit.store.open({
            workspaceId: ctx.workspaceId,
            leadId,
            connectionId: field(fields, "connection_id") || null,
            platform: source.platform,
            identity: id,
            name: field(fields, "contact_name") || null,
            source,
            lastUserAt: isMessage ? source.at : null,
            lastUserText: isMessage ? clip(field(fields, "text"), 1000) : null,
        })
        if (opened !== null) return opened
        // The same person was opened at the same moment: take that flow.
        const again = (await this.kit.store.candidates(ctx.workspaceId, id)).find(
            (flow) =>
                flow.lead_id === leadId ||
                (id.psid !== null && flow.psid === id.psid) ||
                (id.igsid !== null && flow.igsid === id.igsid),
        )
        if (again === undefined) throw new LeadFlowsError({ code: LeadFlowsErrorCode.NotStored })
        return again
    }

    /** One row per lead: identity keys fill in, touches add up, the first source is kept. */
    private touchPatch(
        flow: LeadFlow,
        leadId: string,
        fields: FlowFields,
        source: LeadSource,
        id: Identity,
    ): LeadFlowPatch {
        const name = field(fields, "contact_name")
        const connectionId = field(fields, "connection_id")
        const isMessage = source.kind === "dm"
        return {
            ...identityPatch(flow, id),
            touches: addTouch(flow.touches, source),
            ...(flow.lead_id === null ? { lead_id: leadId } : {}),
            ...(flow.connection_id === null && connectionId !== "" ? { connection_id: connectionId } : {}),
            ...(flow.platform === null ? { platform: source.platform } : {}),
            ...(flow.name === null && name !== "" ? { name } : {}),
            ...(isMessage ? { last_user_at: source.at, last_user_text: clip(field(fields, "text"), 1000) } : {}),
        }
    }

    /** A conversation per message thread or comment, so a person can read and take it over. */
    private async startTranscript(
        ctx: WorkContext,
        flow: LeadFlow,
        source: LeadSource,
        text: string,
    ): Promise<LeadFlow> {
        if (source.kind !== "dm" && source.kind !== "comment") return flow
        const agent = await this.kit.transcript.leadGenAgent(ctx.workspaceId, flow.connection_id)
        const person = flow.platform === "instagram" ? flow.igsid : flow.psid
        const externalId = source.kind === "comment" ? `comment:${source.comment_id ?? ""}` : (person ?? "")
        if (agent === null || externalId === "" || externalId === "comment:") return flow
        const conversationId = await this.kit.transcript.ensure({
            workspaceId: ctx.workspaceId,
            flow,
            externalId,
            agentId: agent.id,
        })
        const body = text || (source.kind === "dm" ? this.kit.text(ctx.locale, "attachment") : "")
        await this.kit.transcript.say({
            workspaceId: ctx.workspaceId,
            conversationId,
            role: "user",
            body,
            delivery: null,
        })
        return conversationId === null ? flow : this.kit.store.patch(flow, { conversation_id: conversationId })
    }
}
