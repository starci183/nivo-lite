import { Injectable } from "@nestjs/common"
import { IsNull, Not } from "typeorm"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { readConnection } from "@modules/platform/pagination"
import type { Connection, PageRequest } from "@modules/platform/pagination"
import { LeadsError, LeadsErrorCode } from "./errors/leads.error"
import type { LeadContactView, LeadView } from "./lead-read.contracts"
import { LeadEntity } from "./persistence/entities"

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
