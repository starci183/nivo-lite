import { Injectable } from "@nestjs/common"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { ConnectionsService } from "@modules/domain/connections"
import { CommandBusService, WorkEngineService } from "@modules/domain/decisions"
import type { WorkContext } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import type { MetaInboundJob } from "@modules/domain/meta-inbox"
import { MetaError, MetaErrorCode } from "@modules/integrations/meta"
import type { MetaEvent, MetaLead } from "@modules/integrations/meta"
import { LeadFlowKitService } from "./lead-flow-kit.service"

/** The language the webhook-started work is written in. */
const LOCALE = "vi"

/** The form fields that are the contact, not an answer. */
const CONTACT_FIELDS: ReadonlySet<string> = new Set([
    "full_name",
    "name",
    "first_name",
    "last_name",
    "phone_number",
    "phone",
    "email",
])

/** A refused token or permission does not heal by retrying. */
const LASTING_FAILURES: ReadonlySet<string> = new Set(["token", "permission", "not_found"])

/** The answers of a form, without the contact fields. */
const answersOf = (lead: MetaLead): string =>
    Object.entries(lead.fields)
        .filter(([key]) => !CONTACT_FIELDS.has(key))
        .map(([key, value]) => `${key.replaceAll("_", " ")}: ${value}`)
        .join("\n")

@Injectable()
/**
 * Facebook Lead Ads: the submission is read from Meta (leads_retrieval), stored as an inbound lead, and given to the agents bound to the
 * connection as a lead source: the lead_gen agent captures it (and hands a hot one to Sales), else Sales takes it through handoff_lead.
 */
export class LeadAdsIntakeService {
    constructor(
        private readonly kit: LeadFlowKitService,
        private readonly bindings: AgentBindingsService,
        private readonly connections: ConnectionsService,
        private readonly inbound: InboundEventsService,
        private readonly commands: CommandBusService,
        private readonly engine: WorkEngineService,
    ) {}

    /** Reads, stores and routes one submission; a redelivery creates nothing new. */
    async accept(job: MetaInboundJob): Promise<void> {
        const event = job.event
        const lead = await this.read(job)
        const name = lead?.name ?? lead?.email ?? lead?.phone ?? this.kit.text(LOCALE, "guest.facebook")
        const need = lead === null ? "" : this.needOf(lead, event)
        const stored = await this.inbound.recordInput({
            workspaceId: job.workspaceId,
            channel: "facebook",
            kind: "lead",
            origin: "live",
            senderName: name,
            senderContact: lead?.phone ?? lead?.email ?? null,
            body: lead === null ? this.kit.text(LOCALE, "lead-ads.unreadable", { id: event.leadgen_id ?? "" }) : need,
            externalRef: event.leadgen_id,
            eventId: `meta:${job.connectionId}:${event.event_key}`,
        })
        if (stored.duplicate) {
            const existing = await this.inbound.find(job.workspaceId, stored.inboundEventId)
            if (existing?.status === "processed") return
        }
        if (lead === null) return
        const sources = await this.bindings.agentsFor(job.connectionId, "lead_source", { acting: true })
        if (sources.length === 0) return
        const ctx: WorkContext = { workspaceId: job.workspaceId, actor: "Facebook Lead Ads", locale: LOCALE }
        const fields = {
            contact_name: name,
            company: "",
            need,
            contact: lead.phone ?? lead.email ?? "",
            channel_label: this.kit.text(LOCALE, "channel.lead-ads"),
        }
        if (sources.some((source) => source.module === "lead_gen")) {
            await this.commands.sendCommandItem(ctx, {
                from: "inbound",
                to: "lead_gen",
                command: "capture_lead",
                reason: "lead_ad",
                origin: "live",
                inboundEventId: stored.inboundEventId,
                dedupeKey: `capture_lead:inbound:${stored.inboundEventId}`,
                payload: {
                    subject_type: "inbound",
                    subject_id: stored.inboundEventId,
                    ...fields,
                    platform: "facebook",
                    source_kind: "leadgen",
                    form_id: event.form_id ?? "",
                    ad_id: event.ad_id ?? "",
                    leadgen_id: event.leadgen_id ?? "",
                    connection_id: job.connectionId,
                    phone: lead.phone ?? "",
                    email: lead.email ?? "",
                    turn: `t:${event.event_key}`,
                    message_at: event.timestamp,
                    text: answersOf(lead),
                },
            })
        } else {
            await this.engine.runWork(ctx, {
                action: "handoff_lead",
                subject_type: "inbound",
                subject_id: stored.inboundEventId,
                inbound_event_id: stored.inboundEventId,
                origin: "live",
                dedupeKey: `handoff_lead:inbound:${stored.inboundEventId}`,
                seed: { fields },
            })
        }
        await this.inbound.mark(job.workspaceId, stored.inboundEventId, "processed", null)
    }

    /** The submission, or null when it cannot be read; a lasting refusal marks the connection for the owner to reconnect. */
    private async read(job: MetaInboundJob): Promise<MetaLead | null> {
        const leadgenId = job.event.leadgen_id
        const page = await this.kit.meta.pageOf(job.workspaceId, job.connectionId)
        if (page === null || leadgenId === null) return null
        try {
            return await this.kit.meta.fetchLead(page, leadgenId)
        } catch (cause) {
            const failure =
                cause instanceof MetaError && cause.code === MetaErrorCode.Refused ? String(cause.params.failure) : ""
            if (!LASTING_FAILURES.has(failure)) throw cause
            await this.connections.markFailing(job.connectionId, this.kit.text(LOCALE, "lead-ads.refused", { failure }))
            return null
        }
    }

    private needOf(lead: MetaLead, event: MetaEvent): string {
        const form =
            event.form_id === null
                ? ""
                : [
                      this.kit.text(LOCALE, "lead-ads.form", { form: event.form_id }),
                      event.ad_id === null ? "" : this.kit.text(LOCALE, "lead-ads.ad", { ad: event.ad_id }),
                  ]
                      .filter((part) => part !== "")
                      .join(", ")
        const suffix = form === "" ? "" : ` (${form})`
        const head = `${this.kit.text(LOCALE, "channel.lead-ads")}${suffix}`
        return [head, answersOf(lead)]
            .filter((part) => part !== "")
            .join("\n")
            .slice(0, 600)
    }
}
