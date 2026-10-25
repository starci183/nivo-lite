import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AutomationBusinessEventsService } from "@modules/domain/automations"
import { DurableWorkService, EvidenceService } from "@modules/domain/decisions"
import type { WorkContext, WorkItem } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { LeadRecordsService, contactParts } from "@modules/domain/leads"
import type { LeadRecordRow } from "@modules/domain/leads"
import { PublicApiError, PublicApiErrorCode } from "./errors/public-api.error"
import type { LeadRequestBody, LegacyLeadRequestBody, PublicLeadFulfillmentResult } from "./public-api.contracts"
import { DEFAULT_API_NEED } from "./public-api.policy"
import { publicLeadMetadata } from "./public-lead-metadata.policy"

@Injectable()
/** Hands admitted API leads to the ordinary authority path and settles already-known customer facts in the caller's transaction. */
export class PublicLeadFulfillmentService {
    constructor(
        private readonly inbound: InboundEventsService,
        private readonly leads: LeadRecordsService,
        private readonly work: DurableWorkService,
        private readonly evidence: EvidenceService,
        private readonly events: AutomationBusinessEventsService,
    ) {}

    /** Records the manual input and its gated handoff together; a new customer is captured only after that gate permits it. */
    async fulfill(
        workspaceId: string,
        requestId: string,
        body: LeadRequestBody,
        tx: EntityManager,
    ): Promise<PublicLeadFulfillmentResult> {
        const known = await this.match(workspaceId, body, tx)
        const recorded = await this.inbound.recordInputInTransaction(
            {
                workspaceId,
                channel: "manual",
                kind: "lead",
                senderName: body.name,
                senderContact: body.contact,
                body: body.need || DEFAULT_API_NEED,
                externalRef: body.source,
                eventId: `api:${requestId}`,
            },
            tx,
        )
        if (recorded.inboundEventId === "") throw new PublicApiError({ code: PublicApiErrorCode.RequestInvalid })
        const ctx: WorkContext = { workspaceId, actor: body.source, locale: "en" }
        const item = await this.handoff(ctx, requestId, requestId, recorded.inboundEventId, body, known, tx)
        const leadId = item.lead_id ?? known?.id ?? null
        await this.evidence.log(
            ctx,
            {
                lead_id: leadId,
                work_item_id: item.id,
                kind: "api.lead",
                actor: body.source,
                summary: `Customer received through the API: ${body.name}`,
                evidence: body.externalId === "" ? body.source : `${body.source} external_id=${body.externalId}`,
            },
            tx,
        )
        return leadId
    }

    /** Reuses the historical inbound identity and evidence instead of admitting another input. */
    async fulfillExistingInbound(
        workspaceId: string,
        stableId: string,
        legacy: LegacyLeadRequestBody,
        tx: EntityManager,
    ): Promise<PublicLeadFulfillmentResult> {
        const event = await this.inbound.find(workspaceId, legacy.inboundEventId, tx)
        if (event?.kind !== "lead" || event.channel !== "manual" || event.external_ref !== `api:${legacy.keyName}`)
            throw new PublicApiError({ code: PublicApiErrorCode.RequestInvalid })
        const parts = contactParts(event.sender_contact)
        let known: LeadRecordRow | null
        if (event.lead_id !== null) {
            known = await this.leads.find(workspaceId, event.lead_id, tx)
            if (known === null) throw new PublicApiError({ code: PublicApiErrorCode.RequestInvalid })
        } else {
            if (parts.phone === null && parts.email === null && legacy.channel === undefined) {
                throw new PublicApiError({
                    code: PublicApiErrorCode.RequestInvalid,
                    params: { field: "legacyChannel" },
                })
            }
            known = await this.leads.match(
                {
                    workspaceId,
                    ...parts,
                    name: legacy.channel === undefined ? null : event.sender_name,
                    channel: legacy.channel ?? null,
                },
                tx,
            )
        }
        const channel = legacy.channel ?? known?.channel
        if (channel === undefined) {
            throw new PublicApiError({ code: PublicApiErrorCode.RequestInvalid, params: { field: "legacyChannel" } })
        }
        const body: LeadRequestBody = {
            name: event.sender_name ?? "",
            contact: event.sender_contact,
            need: event.body,
            channel,
            company: legacy.company,
            note: legacy.note,
            stage: legacy.stage,
            externalId: "",
            source: `api:${legacy.keyName}`,
        }
        const ctx: WorkContext = { workspaceId, actor: body.source, locale: "en" }
        const item = await this.handoff(ctx, stableId, null, event.id, body, known, tx)
        return item.lead_id ?? known?.id ?? null
    }

    /** Applies the API's supplied facts, note and outcome once its customer is known, within the supplied domain transaction. */
    async applyDetails(ctx: WorkContext, leadId: string, body: LeadRequestBody, tx: EntityManager): Promise<void> {
        const supplied = body.needSupplied ?? (body.need !== "" && body.need !== DEFAULT_API_NEED)
        const need = supplied && body.need !== "" ? body.need : null
        if (body.company !== "" || need !== null) {
            await this.leads.patchPublicFacts({ workspaceId: ctx.workspaceId, leadId, company: body.company, need }, tx)
            await this.evidence.log(
                ctx,
                {
                    lead_id: leadId,
                    kind: "api.lead_updated",
                    actor: body.source,
                    summary: "Customer facts updated through the API",
                    evidence: body.source,
                },
                tx,
            )
        }
        if (body.note !== "")
            await this.evidence.log(
                ctx,
                {
                    lead_id: leadId,
                    kind: "api.note",
                    actor: body.source,
                    summary: "Note received through the API",
                    evidence: body.note,
                },
                tx,
            )
        if (body.stage === null) return
        const changed = await this.leads.applyPublicStage(ctx.workspaceId, leadId, body.stage, tx)
        if (changed === null) return
        await this.evidence.log(
            ctx,
            {
                lead_id: leadId,
                kind: "outcome.recorded",
                actor: body.source,
                summary: `Customer stage set through the API: ${body.stage}`,
                evidence: body.source,
            },
            tx,
        )
        if (body.stage === "won") await this.win(ctx, changed, body.source, tx)
    }

    private match(workspaceId: string, body: LeadRequestBody, tx: EntityManager): Promise<LeadRecordRow | null> {
        return this.leads.match(
            { workspaceId, ...contactParts(body.contact), name: body.name, channel: body.channel },
            tx,
        )
    }

    private async handoff(
        ctx: WorkContext,
        completionId: string,
        ledgerRequestId: string | null,
        inboundEventId: string,
        body: LeadRequestBody,
        known: LeadRecordRow | null,
        tx: EntityManager,
    ): Promise<WorkItem> {
        const metadata = known === null ? publicLeadMetadata(completionId, ledgerRequestId, body) : undefined
        const item = await this.work.enqueueCommand(
            ctx,
            {
                from: "inbound",
                to: "chatbot",
                command: "handoff_lead",
                reason: "lead received through the API",
                inboundEventId,
                dedupeKey: `handoff_lead:inbound:${inboundEventId}`,
                payload: {
                    subject_type: "inbound",
                    subject_id: inboundEventId,
                    lead_id: known?.id ?? null,
                    contact_name: body.name,
                    company: body.company,
                    need: body.need || DEFAULT_API_NEED,
                    contact: body.contact,
                    channel_label: body.channel,
                    public_api_lead: metadata,
                },
            },
            tx,
        )
        if (known !== null) await this.applyDetails(ctx, known.id, body, tx)
        return item
    }

    private async win(ctx: WorkContext, lead: LeadRecordRow, source: string, tx: EntityManager): Promise<void> {
        await this.work.enqueueWork(
            ctx,
            {
                action: "issue_invoice",
                subject_type: "lead",
                subject_id: lead.id,
                lead_id: lead.id,
                dedupeKey: `issue_invoice:lead:${lead.id}`,
                seed: { amount_vnd: null, fields: {} },
            },
            tx,
        )
        await this.events.publish(
            ctx.workspaceId,
            "deal.won",
            {
                lead_id: lead.id,
                name: lead.contact_name,
                company: lead.company,
                channel: lead.channel,
                need: lead.need,
                source,
            },
            `deal.won:${lead.id}`,
            tx,
        )
    }
}
