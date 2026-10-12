import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ApiKeysService } from "@modules/domain/api-keys"
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
    RecordedRequest,
} from "./public-api.contracts"
import { clampLimit, contactParts, dedupePrefix, leadFacts, normaliseContact } from "./public-api.policy"
import type { LeadsRow } from "./persistence/public-api.rows"
import {
    INSERT_REQUEST,
    LIST_LEADS,
    MATCH_LEAD_BY_EMAIL,
    MATCH_LEAD_BY_NAME,
    MATCH_LEAD_BY_PHONE,
} from "./persistence/public-api.sql"

/** Customers listed by default and at most. */
const LEADS_LIMIT_DEFAULT = 50
const LEADS_LIMIT_MAX = 200

/** The text recorded for a customer handed over without a need. */
const DEFAULT_NEED = "Created through the API"

type LeadId = Pick<LeadsRow, "id">
type LeadRow = Pick<
    LeadsRow,
    "id" | "contact_name" | "company" | "channel" | "need" | "stage" | "phone" | "email" | "created_at"
>

const toLeadItem = (row: LeadRow): LeadListItem => ({
    id: row.id,
    name: row.contact_name,
    company: row.company,
    channel: row.channel,
    need: row.need,
    stage: row.stage,
    phone: row.phone ?? null,
    email: row.email ?? null,
    createdAt: row.created_at,
})

@Injectable()
/** The customers the public API lists and accepts for the workspace of a key, reached only through the shared primary EntityManager; the hand-off itself is a job. */
export class PublicLeadsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly queue: PublicApiQueue,
        private readonly keys: ApiKeysService,
    ) {}

    /** The customers of the key's workspace, newest first, optionally of one stage. */
    async listLeads(params: ListLeadsParams): Promise<Array<LeadListItem>> {
        const who = await this.keys.authenticate("leads:read", params.authorization)
        const limit = clampLimit(params.limit, LEADS_LIMIT_DEFAULT, LEADS_LIMIT_MAX)
        const rows = await this.entityManager.query<Array<LeadRow>>(LIST_LEADS, [
            who.workspaceId,
            params.stage ?? null,
            limit,
        ])
        return rows.map(toLeadItem)
    }

    /**
     * Hands a customer over: the request is recorded in the ledger and its job is enqueued in one transaction, so the job exists exactly
     * when the request does. The same external id of the same key is one request; a repeat only counts.
     */
    async acceptLead(params: AcceptLeadParams): Promise<AcceptedLead> {
        const who = await this.keys.authenticate("leads:write", params.authorization)
        const lead = leadFacts(params)
        const contact = lead.phone || lead.email || null
        const body: LeadRequestBody = {
            name: lead.name,
            contact: normaliseContact(contact),
            need: lead.need || DEFAULT_NEED,
            channel: lead.channel,
            company: lead.company,
            note: lead.note,
            stage: lead.stage,
            externalId: lead.externalId,
            source: `api:${who.name}`,
        }
        return this.entityManager.transaction(async (tx) => {
            const known = await this.matchLead(tx, who.workspaceId, contactParts(contact), lead.name, lead.channel)
            const [request] = await tx.query<Array<RecordedRequest>>(INSERT_REQUEST, [
                who.workspaceId,
                who.keyId,
                "lead",
                dedupePrefix("lead", who.keyId),
                lead.externalId,
                JSON.stringify(body),
            ])
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
        if (parts.phone !== null) {
            const [byPhone] = await tx.query<Array<LeadId>>(MATCH_LEAD_BY_PHONE, [workspaceId, parts.phone])
            if (byPhone !== undefined) return byPhone.id
        }
        if (parts.email !== null) {
            const [byEmail] = await tx.query<Array<LeadId>>(MATCH_LEAD_BY_EMAIL, [workspaceId, parts.email])
            if (byEmail !== undefined) return byEmail.id
        }
        if (parts.phone !== null || parts.email !== null) return undefined
        const [byName] = await tx.query<Array<LeadId>>(MATCH_LEAD_BY_NAME, [workspaceId, name, channel])
        return byName?.id
    }
}
