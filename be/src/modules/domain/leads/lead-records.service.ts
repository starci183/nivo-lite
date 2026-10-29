import { Injectable } from "@nestjs/common"
import { Not } from "typeorm"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ContactParts } from "./contact.policy"
import { LeadsError, LeadsErrorCode } from "./errors/leads.error"
import type {
    ContactFill,
    LeadClassification,
    LeadMatch,
    LeadName,
    LeadRecord,
    NewLead,
    OptionalLeadRecord,
    PublicLeadFactsPatch,
} from "./lead-records.contracts"
import { LeadEntity } from "./persistence/entities"

/** The `RETURNING` clause of a statement that answers the lead it wrote. */
const LEAD_RETURNING = "id, workspace_id, contact_name, company, channel, need, stage, context_summary, phone, email"

/** The most leads one contact lookup answers. */
const CONTACT_LIMIT = 20

/** The most names one lookup answers. */
const NAME_LIMIT = 200

@Injectable()
/** The customers of a workspace as the engine finds, captures and classifies them. */
export class LeadRecordsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The installation that owns a lead of the workspace; null when there is no such row or it names no installation. */
    async installationIdOf(workspaceId: string, id: string): Promise<string | null> {
        const row = await this.entityManager.findOne(LeadEntity, {
            select: { installationId: true },
            where: { workspaceId, id },
        })
        return row?.installationId ?? null
    }

    /** The lead of the workspace, or null when there is none with that id. */
    async find(
        workspaceId: string,
        leadId: string,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalLeadRecord> {
        const lead = await this.recordQuery(manager, workspaceId)
            .andWhere("l.id = :leadId", { leadId })
            .limit(1)
            .getRawOne<LeadRecord>()
        return lead ?? null
    }

    /** The lead of the workspace; refused when there is none. */
    async require(workspaceId: string, leadId: string): Promise<LeadRecord> {
        const lead = await this.find(workspaceId, leadId)
        if (lead === null) throw new LeadsError({ code: LeadsErrorCode.NotFound, params: { id: leadId } })
        return lead
    }

    /** Matches a customer by phone, email, or exact name and channel when the input has no contact. */
    async match(match: LeadMatch, manager: EntityManager = this.entityManager): Promise<OptionalLeadRecord> {
        const name = match.name?.trim() ?? ""
        const alternatives: Array<string> = []
        if (match.phone !== null) alternatives.push("l.phone = :phone")
        if (match.email !== null) alternatives.push("l.email = :email")
        if (match.phone === null && match.email === null && name !== "" && match.channel !== null) {
            alternatives.push("(l.contact_name = :name AND l.channel = :channel)")
        }
        if (alternatives.length === 0) return null
        const lead = await this.recordQuery(manager, match.workspaceId)
            .andWhere(`(${alternatives.join(" OR ")})`)
            .orderBy(
                "CASE WHEN l.phone = CAST(:phone AS text) THEN 0 WHEN l.email = CAST(:email AS text) THEN 1 ELSE 2 END",
            )
            .addOrderBy("l.created_at", "ASC")
            .setParameters({ phone: match.phone, email: match.email, name, channel: match.channel })
            .limit(1)
            .getRawOne<LeadRecord>()
        return lead ?? null
    }

    /**
     * Every lead of the workspace that holds the phone or the email, the phone matches first, then the oldest; used to link a
     * customer known by contact (a contract) to the lead a conversation already reached, never to a second copy.
     */
    matchAllByContact(
        workspaceId: string,
        contact: ContactParts,
        manager: EntityManager = this.entityManager,
    ): Promise<Array<LeadRecord>> {
        if (contact.phone === null && contact.email === null) return Promise.resolve([])
        const alternatives: Array<string> = []
        if (contact.phone !== null) alternatives.push("l.phone = :phone")
        if (contact.email !== null) alternatives.push("l.email = :email")
        return this.recordQuery(manager, workspaceId)
            .andWhere(`(${alternatives.join(" OR ")})`)
            .orderBy("CASE WHEN l.phone = CAST(:phone AS text) THEN 0 ELSE 1 END")
            .addOrderBy("l.created_at", "ASC")
            .addOrderBy("l.id", "ASC")
            .setParameters({ phone: contact.phone, email: contact.email })
            .limit(CONTACT_LIMIT)
            .getRawMany<LeadRecord>()
    }

    /** Captures a new customer, in the caller's transaction when one is given. */
    async capture(lead: NewLead, manager: EntityManager = this.entityManager): Promise<LeadRecord> {
        const result = await manager
            .createQueryBuilder(LeadEntity, "l")
            .insert()
            .values({
                workspaceId: lead.workspaceId,
                contactName: lead.contactName,
                company: lead.company,
                channel: lead.channel,
                need: lead.need,
                phone: lead.phone,
                email: lead.email,
            })
            .returning(LEAD_RETURNING)
            .execute()
        const [created] = result.raw as Array<LeadRecord>
        if (created === undefined) throw new LeadsError({ code: LeadsErrorCode.NotFound, params: { id: "new" } })
        return created
    }

    /** Adds the phone or the email the lead was missing; one it already has is kept. */
    async fillContact(fill: ContactFill, manager: EntityManager = this.entityManager): Promise<void> {
        await manager
            .createQueryBuilder(LeadEntity, "l")
            .update()
            .set({
                phone: () => "COALESCE(phone, CAST(:phone AS text))",
                email: () => "COALESCE(email, CAST(:email AS text))",
            })
            .where("workspace_id = :workspaceId AND id = :leadId", {
                workspaceId: fill.workspaceId,
                leadId: fill.leadId,
            })
            .setParameters({ phone: fill.phone, email: fill.email })
            .execute()
    }

    /** Stores what the sales AI learned: the stage of an open deal and a context brief the lead did not have. */
    async classify(classification: LeadClassification, manager: EntityManager = this.entityManager): Promise<void> {
        await manager
            .createQueryBuilder(LeadEntity, "l")
            .update()
            .set({
                stage: () =>
                    "CASE WHEN stage IN ('won', 'lost') OR CAST(:stage AS text) = 'won' THEN stage ELSE COALESCE(CAST(:stage AS text), stage) END",
                contextSummary: () => "COALESCE(context_summary, CAST(:summary AS text))",
            })
            .where("workspace_id = :workspaceId AND id = :leadId", {
                workspaceId: classification.workspaceId,
                leadId: classification.leadId,
            })
            .setParameters({ stage: classification.stage, summary: classification.contextSummary })
            .execute()
    }

    /** Replaces the brief after the background agent has refreshed the customer's context. */
    async replaceContext(
        workspaceId: string,
        leadId: string,
        summary: string,
        manager: EntityManager = this.entityManager,
    ): Promise<void> {
        await manager.update(LeadEntity, { workspaceId, id: leadId }, { contextSummary: summary })
    }

    /** Writes the package a lead goes to Sales with as its need, and as its brief when it has none. */
    async handOver(workspaceId: string, leadId: string, need: string): Promise<void> {
        await this.entityManager
            .createQueryBuilder(LeadEntity, "l")
            .update()
            .set({ need, contextSummary: () => "COALESCE(context_summary, CAST(:need AS text))" })
            .where("workspace_id = :workspaceId AND id = :leadId", { workspaceId, leadId })
            .setParameter("need", need)
            .execute()
    }

    /** A confirmed order won the deal, unless it was lost. */
    async markWon(workspaceId: string, leadId: string, manager: EntityManager = this.entityManager): Promise<void> {
        await manager.update(LeadEntity, { workspaceId, id: leadId, stage: Not("lost") }, { stage: "won" })
    }

    /** Patches only the supplied nonempty API facts in the caller's transaction; null need preserves it. */
    async patchPublicFacts(patch: PublicLeadFactsPatch, manager: EntityManager): Promise<void> {
        await manager
            .createQueryBuilder(LeadEntity, "l")
            .update()
            .set({
                company: () => "COALESCE(NULLIF(CAST(:company AS text), ''), company)",
                need: () => "COALESCE(NULLIF(CAST(:need AS text), ''), need)",
            })
            .where("workspace_id = :workspaceId AND id = :leadId", {
                workspaceId: patch.workspaceId,
                leadId: patch.leadId,
            })
            .setParameters({ company: patch.company, need: patch.need })
            .execute()
    }

    /** Applies an API outcome once, without reopening a closed deal; null means no stage changed. */
    async applyPublicStage(
        workspaceId: string,
        leadId: string,
        stage: string,
        manager: EntityManager,
    ): Promise<OptionalLeadRecord> {
        const result = await manager
            .createQueryBuilder(LeadEntity, "l")
            .update()
            .set({ stage: () => "CAST(:stage AS text)" })
            .where(
                "workspace_id = :workspaceId AND id = :leadId AND stage <> CAST(:stage AS text) AND (stage NOT IN ('won', 'lost') OR CAST(:stage AS text) IN ('won', 'lost'))",
                { workspaceId, leadId },
            )
            .setParameter("stage", stage)
            .returning(LEAD_RETURNING)
            .execute()
        const [changed] = result.raw as Array<LeadRecord>
        return changed ?? null
    }

    /** Holds the lead of the workspace `FOR SHARE` in the caller's transaction, so it cannot go away before the caller writes; false when the workspace has no such lead. */
    async hold(workspaceId: string, leadId: string, manager: EntityManager): Promise<boolean> {
        const lead = await manager.findOne(LeadEntity, {
            select: { id: true },
            where: { workspaceId, id: leadId },
            lock: { mode: "pessimistic_read" },
        })
        return lead !== null
    }

    /** The names of the given leads. */
    namesOf(workspaceId: string, leadIds: ReadonlyArray<string>): Promise<Array<LeadName>> {
        if (leadIds.length === 0) return Promise.resolve([])
        return this.entityManager
            .createQueryBuilder(LeadEntity, "l")
            .select("l.id", "id")
            .addSelect("l.contactName", "contact_name")
            .where("l.workspaceId = :workspaceId AND l.id = ANY(:leadIds)", { workspaceId, leadIds: [...leadIds] })
            .limit(NAME_LIMIT)
            .getRawMany<LeadName>()
    }

    /** The leads of a workspace, selected as lead records. */
    private recordQuery(manager: EntityManager, workspaceId: string): SelectQueryBuilder<LeadEntity> {
        return manager
            .createQueryBuilder(LeadEntity, "l")
            .select("l.id", "id")
            .addSelect("l.workspaceId", "workspace_id")
            .addSelect("l.contactName", "contact_name")
            .addSelect("l.company", "company")
            .addSelect("l.channel", "channel")
            .addSelect("l.need", "need")
            .addSelect("l.stage", "stage")
            .addSelect("l.contextSummary", "context_summary")
            .addSelect("l.phone", "phone")
            .addSelect("l.email", "email")
            .where("l.workspaceId = :workspaceId", { workspaceId })
    }
}
