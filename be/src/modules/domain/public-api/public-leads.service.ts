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

/** The id of a customer the hand-over matched. */
interface LeadId {
    /** The customer id. */
    readonly id: string
}

/** One public.leads row as the public API lists it. */
interface LeadRow extends LeadId {
    /** The customer's name. */
    readonly contact_name: string
    /** The company, empty when unknown. */
    readonly company: string
    /** The channel the customer came through. */
    readonly channel: string
    /** What the customer needs. */
    readonly need: string
    /** The stage of the deal. */
    readonly stage: string
    /** The normalised phone, or null. */
    readonly phone: string | null
    /** The normalised email, or null. */
    readonly email: string | null
    /** When the customer was created, ISO 8601 as the select formats it. */
    readonly created_at: string
}

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
        private readonly ledger: PublicApiLedgerService,
    ) {}

    /** The customers of the key's workspace, newest first, optionally of one stage. */
    async listLeads(params: ListLeadsParams): Promise<Array<LeadListItem>> {
        const who = await this.keys.authenticate("leads:read", params.authorization)
        const limit = clampLimit(params.limit, LEADS_LIMIT_DEFAULT, LEADS_LIMIT_MAX)
        const rows = await this.entityManager
            .createQueryBuilder()
            .select("l.id", "id")
            .addSelect("l.contact_name", "contact_name")
            .addSelect("l.company", "company")
            .addSelect("l.channel", "channel")
            .addSelect("l.need", "need")
            .addSelect("l.stage", "stage")
            .addSelect("l.phone", "phone")
            .addSelect("l.email", "email")
            .addSelect("to_char(l.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')", "created_at")
            .from("public.leads", "l")
            .where("l.workspace_id = :workspaceId AND (:stage::text IS NULL OR l.stage = :stage)", {
                workspaceId: who.workspaceId,
                stage: params.stage ?? null,
            })
            .orderBy("l.created_at", "DESC")
            .limit(limit)
            .getRawMany<LeadRow>()
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
        if (parts.phone !== null) {
            const byPhone = await this.oldestLead(tx, workspaceId, "l.phone = :phone", { phone: parts.phone })
            if (byPhone !== undefined) return byPhone.id
        }
        if (parts.email !== null) {
            const byEmail = await this.oldestLead(tx, workspaceId, "l.email = :email", { email: parts.email })
            if (byEmail !== undefined) return byEmail.id
        }
        if (parts.phone !== null || parts.email !== null) return undefined
        const byName = await this.oldestLead(tx, workspaceId, "l.contact_name = :name AND l.channel = :channel", {
            name,
            channel,
        })
        return byName?.id
    }

    /** The oldest customer of a workspace that satisfies one condition. */
    private oldestLead(
        tx: EntityManager,
        workspaceId: string,
        condition: string,
        parameters: Record<string, string>,
    ): Promise<LeadId | undefined> {
        return tx
            .createQueryBuilder()
            .select("l.id", "id")
            .from("public.leads", "l")
            .where(`l.workspace_id = :workspaceId AND ${condition}`, { workspaceId, ...parameters })
            .orderBy("l.created_at")
            .limit(1)
            .getRawOne<LeadId>()
    }
}
