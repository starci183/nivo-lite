import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ApiKeysService } from "@modules/domain/api-keys"
import { LeadReadService, LeadRecordsService } from "@modules/domain/leads"
import type { ApiLead } from "@modules/domain/leads"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { PublicApiQueue } from "@modules/queues/public-api"
import { PublicApiError, PublicApiErrorCode } from "./errors/public-api.error"
import type {
    AcceptLeadParams,
    AcceptedLead,
    ContactParts,
    LeadListItem,
    LeadRequestBody,
    ListLeadsParams,
} from "./public-api.contracts"
import {
    clampLimit,
    contactParts,
    DEFAULT_API_NEED,
    dedupePrefix,
    leadFacts,
    normaliseContact,
} from "./public-api.policy"
import { PublicApiLedgerService } from "./public-api-ledger.service"

/** Customers listed by default and at most. */
const LEADS_LIMIT_DEFAULT = 50
const LEADS_LIMIT_MAX = 200

/** One customer as the public API lists it. */
const toLeadItem = (lead: ApiLead): LeadListItem => ({
    id: lead.id,
    name: lead.contactName,
    company: lead.company,
    channel: lead.channel,
    need: lead.need,
    stage: lead.stage,
    phone: lead.phone,
    email: lead.email,
    createdAt: lead.createdAt.toISOString(),
})

@Injectable()
/** The customers the public API lists and accepts for the workspace of a key, reached only through the shared primary EntityManager; the hand-off itself is a job. */
export class PublicLeadsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly queue: PublicApiQueue,
        private readonly keys: ApiKeysService,
        private readonly ledger: PublicApiLedgerService,
        private readonly leads: LeadReadService,
        private readonly leadRecords: LeadRecordsService,
    ) {}

    /** The customers of the key's workspace, newest first, optionally of one stage. */
    async listLeads(params: ListLeadsParams): Promise<Array<LeadListItem>> {
        const who = await this.keys.authenticate("leads:read", params.authorization)
        const limit = clampLimit(params.limit, LEADS_LIMIT_DEFAULT, LEADS_LIMIT_MAX)
        const leads = await this.leads.listForApi(who.workspaceId, params.stage ?? null, limit)
        return leads.map(toLeadItem)
    }

    /**
     * Hands a customer over: the request is recorded in the ledger and its job is enqueued in one transaction, so the job exists exactly
     * when the request does. The same external id of the same key is one request; a repeat only counts.
     */
    async acceptLead(params: AcceptLeadParams): Promise<AcceptedLead> {
        const who = await this.keys.authenticate("leads:write", params.authorization)
        const lead = leadFacts(params)
        const contact = lead.phone || lead.email || null
        const needSupplied = lead.need !== ""
        const body: LeadRequestBody = {
            name: lead.name,
            contact: normaliseContact(contact),
            need: lead.need || DEFAULT_API_NEED,
            needSupplied,
            channel: lead.channel,
            company: lead.company,
            note: lead.note,
            stage: lead.stage,
            externalId: lead.externalId,
            source: `api:${who.name}`,
        }
        return this.entityManager.transaction(async (tx) => {
            const known = await this.matchLead(tx, who.workspaceId, contactParts(contact), lead.name, lead.channel)
            const request = await this.ledger.record(
                {
                    workspaceId: who.workspaceId,
                    keyId: who.keyId,
                    kind: "lead",
                    prefix: dedupePrefix("lead", who.keyId),
                    suffix: lead.externalId,
                    body,
                    needSupplied,
                },
                tx,
            )
            if (request === undefined) throw new PublicApiError({ code: PublicApiErrorCode.NotWritten })
            if (!request.inserted) return { leadId: request.lead_id ?? known ?? null, status: "unchanged" }
            await this.queue.enqueueRequest({ requestId: request.id, workspaceId: who.workspaceId }, tx)
            return { leadId: known ?? null, status: "accepted" }
        })
    }

    /** The customer a hand-over belongs to: by phone, then email, then name and channel when the request carries no contact at all. */
    private async matchLead(
        tx: EntityManager,
        workspaceId: string,
        parts: ContactParts,
        name: string,
        channel: string,
    ): Promise<string | undefined> {
        const lead = await this.leadRecords.match(
            { workspaceId, phone: parts.phone, email: parts.email, name, channel },
            tx,
        )
        return lead?.id
    }
}
