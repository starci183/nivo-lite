import { Injectable } from "@nestjs/common"
import { ILike, In, IsNull, Not } from "typeorm"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { readConnection } from "@modules/platform/pagination"
import type { Connection, PageRequest } from "@modules/platform/pagination"
import { LeadsError, LeadsErrorCode } from "./errors/leads.error"
import type {
    ApiLead,
    LeadCard,
    LeadContactView,
    LeadName,
    LeadSummary,
    LeadView,
    WebsiteLead,
} from "./lead-read.contracts"
import { LeadEntity } from "./persistence/entities"
import type { LeadStage } from "./persistence/entities"

/** The most recent leads one board read answers. */
const BOARD_LIMIT = 500

/** The most leads one reference lookup answers. */
const REFERENCE_LIMIT = 1000

/** The contact details a stored lead holds. */
const contactOf = (row: Pick<LeadEntity, "id" | "contactName" | "phone" | "email">): LeadContactView => ({
    id: row.id,
    contact_name: row.contactName,
    phone: row.phone,
    email: row.email,
})

@Injectable()
/** Workspace-scoped lead reads used after the caller's membership has been proved. */
export class LeadReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The recent leads of the workspace, newest first. */
    list(workspaceId: string): Promise<Array<LeadView>> {
        return this.viewQuery(workspaceId)
            .orderBy("l.created_at", "DESC")
            .addOrderBy("l.id", "DESC")
            .limit(BOARD_LIMIT)
            .getRawMany<LeadView>()
    }

    /** The lead board's next bounded page, preserving the database's exact creation timestamps. */
    listPage(workspaceId: string, request: PageRequest): Promise<Connection<LeadView>> {
        return readConnection(request, `leadBoard:${workspaceId}`, ([after, afterId, limit]) => {
            const query = this.viewQuery(workspaceId)
            if (after !== null) {
                query.andWhere("(l.created_at, l.id) < (CAST(:after AS timestamptz), CAST(:afterId AS uuid))", {
                    after,
                    afterId,
                })
            }
            return query.orderBy("l.created_at", "DESC").addOrderBy("l.id", "DESC").limit(limit).getRawMany<LeadView>()
        })
    }

    /** Whether the workspace has a lead with this id. */
    exists(workspaceId: string, leadId: string): Promise<boolean> {
        return this.entityManager.exists(LeadEntity, { where: { workspaceId, id: leadId } })
    }

    /** The newest leads of the workspace reduced to who they are, newest first, bounded by the caller. */
    async recentNames(workspaceId: string, limit: number): Promise<Array<LeadName>> {
        const leads = await this.entityManager.find(LeadEntity, {
            select: { id: true, contactName: true, company: true },
            where: { workspaceId },
            order: { createdAt: "DESC", id: "DESC" },
            take: limit,
        })
        return leads.map((lead) => ({ id: lead.id, contactName: lead.contactName, company: lead.company }))
    }

    /** Reads the customer references of a bounded work-item listing, including older leads outside the board's window. */
    listByIds(workspaceId: string, leadIds: ReadonlyArray<string>): Promise<Array<LeadView>> {
        if (leadIds.length === 0) return Promise.resolve([])
        return this.viewQuery(workspaceId)
            .andWhere("l.id = ANY(:leadIds)", { leadIds: [...leadIds] })
            .orderBy("l.created_at", "DESC")
            .addOrderBy("l.id", "DESC")
            .limit(REFERENCE_LIMIT)
            .getRawMany<LeadView>()
    }

    /** One lead of the workspace; an unknown or foreign id raises the same not-found error. */
    async require(workspaceId: string, leadId: string): Promise<LeadView> {
        const lead = await this.viewQuery(workspaceId)
            .andWhere("l.id = :leadId", { leadId })
            .limit(1)
            .getRawOne<LeadView>()
        if (lead === undefined) throw new LeadsError({ code: LeadsErrorCode.NotFound, params: { id: leadId } })
        return lead
    }

    /** The leads of the workspace that carry a phone or an email, oldest first. */
    async listContacts(workspaceId: string, limit: number): Promise<Array<LeadContactView>> {
        const rows = await this.entityManager.find(LeadEntity, {
            select: { id: true, contactName: true, phone: true, email: true },
            where: [
                { workspaceId, phone: Not(IsNull()) },
                { workspaceId, email: Not(IsNull()) },
            ],
            order: { createdAt: "ASC", id: "ASC" },
            take: limit,
        })
        return rows.map(contactOf)
    }

    /** The phone and email of one lead of the workspace, or null when the workspace has no such lead. */
    async contactOf(workspaceId: string, leadId: string): Promise<LeadContactView | null> {
        const row = await this.entityManager.findOne(LeadEntity, {
            select: { id: true, contactName: true, phone: true, email: true },
            where: { workspaceId, id: leadId },
        })
        return row === null ? null : contactOf(row)
    }

    /** True when the lead belongs to the workspace; `manager` joins the caller's transaction. */
    async isOwn(workspaceId: string, leadId: string, manager: EntityManager = this.entityManager): Promise<boolean> {
        return manager.exists(LeadEntity, { where: { workspaceId, id: leadId } })
    }

    /** The cards of the given leads of the workspace, in no particular order (a missing id is missing from the answer). */
    async cardsOf(workspaceId: string, leadIds: ReadonlyArray<string>): Promise<Array<LeadCard>> {
        if (leadIds.length === 0) return []
        const leads = await this.entityManager.find(LeadEntity, {
            select: { id: true, contactName: true, company: true, channel: true, stage: true, email: true },
            where: { workspaceId, id: In([...new Set(leadIds)]) },
        })
        return leads.map((lead) => ({
            id: lead.id,
            contactName: lead.contactName,
            company: lead.company,
            channel: lead.channel,
            stage: lead.stage,
            email: lead.email,
        }))
    }

    /** How many leads of the workspace were created from the first instant (included) to the second (excluded). */
    countCreatedBetween(workspaceId: string, from: Date, to: Date): Promise<number> {
        return this.entityManager
            .createQueryBuilder(LeadEntity, "l")
            .where("l.workspaceId = :workspaceId AND l.createdAt >= :from AND l.createdAt < :to", {
                workspaceId,
                from,
                to,
            })
            .getCount()
    }

    /** The leads that came in through the website channel, in no particular order. */
    async websiteOf(workspaceId: string): Promise<Array<WebsiteLead>> {
        const leads = await this.entityManager.find(LeadEntity, {
            select: { id: true, createdAt: true },
            where: { workspaceId, channel: ILike("%website%") },
        })
        return leads.map((lead) => ({ id: lead.id, createdAt: lead.createdAt }))
    }

    /** The ids of the leads of the workspace that stand at one stage. */
    async idsAtStage(workspaceId: string, stage: LeadStage): Promise<Array<string>> {
        const leads = await this.entityManager.find(LeadEntity, { select: { id: true }, where: { workspaceId, stage } })
        return leads.map((lead) => lead.id)
    }

    /** The leads of the workspace reduced to what a dashboard counts, in no particular order, bounded by the caller. */
    async summariesOf(workspaceId: string, limit: number): Promise<Array<LeadSummary>> {
        const leads = await this.entityManager.find(LeadEntity, {
            select: { id: true, contactName: true, company: true, stage: true, createdAt: true },
            where: { workspaceId },
            take: limit,
        })
        return leads.map((lead) => ({
            id: lead.id,
            contactName: lead.contactName,
            company: lead.company,
            stage: lead.stage,
            createdAt: lead.createdAt,
        }))
    }

    /** The leads of the workspace for the public API, newest first, optionally of one stage, bounded by the caller. */
    async listForApi(workspaceId: string, stage: string | null, limit: number): Promise<Array<ApiLead>> {
        const query = this.entityManager
            .createQueryBuilder(LeadEntity, "l")
            .where("l.workspaceId = :workspaceId", { workspaceId })
        if (stage !== null) query.andWhere("l.stage = :stage", { stage })
        const leads = await query.orderBy("l.createdAt", "DESC").limit(limit).getMany()
        return leads.map((lead) => ({
            id: lead.id,
            contactName: lead.contactName,
            company: lead.company,
            channel: lead.channel,
            need: lead.need,
            stage: lead.stage,
            phone: lead.phone,
            email: lead.email,
            createdAt: lead.createdAt,
        }))
    }

    /** The leads of a workspace, selected as board views with the creation time as ISO text. */
    private viewQuery(workspaceId: string): SelectQueryBuilder<LeadEntity> {
        return this.entityManager
            .createQueryBuilder(LeadEntity, "l")
            .select("l.id", "id")
            .addSelect("l.contactName", "contact_name")
            .addSelect("l.company", "company")
            .addSelect("l.channel", "channel")
            .addSelect("l.need", "need")
            .addSelect("l.stage", "stage")
            .addSelect("l.contextSummary", "context_summary")
            .addSelect("l.installationId", "installation_id")
            .addSelect("to_json(l.created_at) #>> '{}'", "created_at")
            .where("l.workspaceId = :workspaceId", { workspaceId })
    }
}
