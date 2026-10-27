import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ContactParts } from "./contact.policy"
import { LeadsError, LeadsErrorCode } from "./errors/leads.error"
import type {
    ContactFill,
    LeadClassification,
    LeadMatch,
    LeadName,
    NewLead,
    OptionalLeadRecord,
    PublicLeadFactsPatch,
} from "./lead-records.contracts"
import type { LeadRecordRow } from "./persistence/lead-records.rows"
import {
    APPLY_CLASSIFICATION,
    FILL_LEAD_CONTACT,
    FIND_LEAD,
    FIND_LEAD_NAMES,
    HAND_OVER_LEAD_NEED,
    INSERT_LEAD,
    MARK_LEAD_WON,
    MATCH_LEAD,
    MATCH_LEADS_BY_CONTACT,
    REPLACE_LEAD_CONTEXT,
    PATCH_PUBLIC_LEAD,
    APPLY_PUBLIC_LEAD_STAGE,
} from "./persistence/lead-records.sql"

@Injectable()
/** The customers of a workspace as the engine finds, captures and classifies them. */
export class LeadRecordsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The lead of the workspace, or null when there is none with that id. */
    async find(
        workspaceId: string,
        leadId: string,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalLeadRecord> {
        const rows = await manager.query<Array<LeadRecordRow>>(FIND_LEAD, [workspaceId, leadId])
        return rows[0] ?? null
    }

    /** The lead of the workspace; refused when there is none. */
    async require(workspaceId: string, leadId: string): Promise<LeadRecordRow> {
        const lead = await this.find(workspaceId, leadId)
        if (lead === null) throw new LeadsError({ code: LeadsErrorCode.NotFound, params: { id: leadId } })
        return lead
    }

    /** Matches a customer by phone, email, or exact name and channel when the input has no contact. */
    async match(match: LeadMatch, manager: EntityManager = this.entityManager): Promise<OptionalLeadRecord> {
        const name = match.name?.trim() ?? ""
        const rows = await manager.query<Array<LeadRecordRow>>(MATCH_LEAD, [
            match.workspaceId,
            match.phone,
            match.email,
            name === "" ? null : name,
            match.channel,
        ])
        return rows[0] ?? null
    }

    /**
     * Every lead of the workspace that holds the phone or the email, the phone matches first, then the oldest; used to link a
     * customer known by contact (a contract) to the lead a conversation already reached, never to a second copy.
     */
    matchAllByContact(
        workspaceId: string,
        contact: ContactParts,
        manager: EntityManager = this.entityManager,
    ): Promise<Array<LeadRecordRow>> {
        if (contact.phone === null && contact.email === null) return Promise.resolve([])
        return manager.query<Array<LeadRecordRow>>(MATCH_LEADS_BY_CONTACT, [workspaceId, contact.phone, contact.email])
    }

    /** Captures a new customer, in the caller's transaction when one is given. */
    async capture(lead: NewLead, manager: EntityManager = this.entityManager): Promise<LeadRecordRow> {
        const rows = await manager.query<Array<LeadRecordRow>>(INSERT_LEAD, [
            lead.workspaceId,
            lead.contactName,
            lead.company,
            lead.channel,
            lead.need,
            lead.phone,
            lead.email,
        ])
        const [created] = rows
        if (created === undefined) throw new LeadsError({ code: LeadsErrorCode.NotFound, params: { id: "new" } })
        return created
    }

    /** Adds the phone or the email the lead was missing; one it already has is kept. */
    async fillContact(fill: ContactFill, manager: EntityManager = this.entityManager): Promise<void> {
        await manager.query(FILL_LEAD_CONTACT, [fill.workspaceId, fill.leadId, fill.phone, fill.email])
    }

    /** Stores what the sales AI learned: the stage of an open deal and a context brief the lead did not have. */
    async classify(classification: LeadClassification, manager: EntityManager = this.entityManager): Promise<void> {
        await manager.query(APPLY_CLASSIFICATION, [
            classification.workspaceId,
            classification.leadId,
            classification.stage,
            classification.contextSummary,
        ])
    }

    /** Replaces the brief after the background agent has refreshed the customer's context. */
    async replaceContext(
        workspaceId: string,
        leadId: string,
        summary: string,
        manager: EntityManager = this.entityManager,
    ): Promise<void> {
        await manager.query(REPLACE_LEAD_CONTEXT, [workspaceId, leadId, summary])
    }

    /** Writes the package a lead goes to Sales with as its need, and as its brief when it has none. */
    async handOver(workspaceId: string, leadId: string, need: string): Promise<void> {
        await this.entityManager.query(HAND_OVER_LEAD_NEED, [workspaceId, leadId, need])
    }

    /** A confirmed order won the deal, unless it was lost. */
    async markWon(workspaceId: string, leadId: string): Promise<void> {
        await this.entityManager.query(MARK_LEAD_WON, [workspaceId, leadId])
    }

    /** Patches only the supplied nonempty API facts in the caller's transaction; null need preserves it. */
    async patchPublicFacts(patch: PublicLeadFactsPatch, manager: EntityManager): Promise<void> {
        await manager.query(PATCH_PUBLIC_LEAD, [patch.workspaceId, patch.leadId, patch.company, patch.need])
    }

    /** Applies an API outcome once, without reopening a closed deal; null means no stage changed. */
    async applyPublicStage(
        workspaceId: string,
        leadId: string,
        stage: string,
        manager: EntityManager,
    ): Promise<OptionalLeadRecord> {
        const rows = await manager.query<Array<LeadRecordRow>>(APPLY_PUBLIC_LEAD_STAGE, [workspaceId, leadId, stage])
        return rows[0] ?? null
    }

    /** The names of the given leads. */
    namesOf(workspaceId: string, leadIds: ReadonlyArray<string>): Promise<Array<LeadName>> {
        if (leadIds.length === 0) return Promise.resolve([])
        return this.entityManager.query<Array<LeadName>>(FIND_LEAD_NAMES, [workspaceId, leadIds])
    }
}
