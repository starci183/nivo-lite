import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { LeadsError, LeadsErrorCode } from "./errors/leads.error"
import type {
    ContactFill,
    LeadClassification,
    LeadMatch,
    LeadName,
    NewLead,
    OptionalLeadRecord,
} from "./lead-records.contracts"
import type { LeadRecordRow } from "./persistence/lead-records.rows"
import {
    APPLY_CLASSIFICATION,
    FILL_LEAD_CONTACT,
    FIND_LEAD,
    FIND_LEAD_NAMES,
    INSERT_LEAD,
    MARK_LEAD_WON,
    MATCH_LEAD,
    REPLACE_LEAD_CONTEXT,
} from "./persistence/lead-records.sql"

@Injectable()
/** The customers of a workspace as the engine finds, captures and classifies them. */
export class LeadRecordsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The lead of the workspace, or null when there is none with that id. */
    async find(workspaceId: string, leadId: string): Promise<OptionalLeadRecord> {
        const rows = await this.entityManager.query<Array<LeadRecordRow>>(FIND_LEAD, [workspaceId, leadId])
        return rows[0] ?? null
    }

    /** The lead of the workspace; refused when there is none. */
    async require(workspaceId: string, leadId: string): Promise<LeadRecordRow> {
        const lead = await this.find(workspaceId, leadId)
        if (lead === null) throw new LeadsError({ code: LeadsErrorCode.NotFound, params: { id: leadId } })
        return lead
    }

    /** Matches a customer of the same origin by phone, email, or exact name and channel when the input has no contact. */
    async match(match: LeadMatch): Promise<OptionalLeadRecord> {
        const name = match.name?.trim() ?? ""
        const rows = await this.entityManager.query<Array<LeadRecordRow>>(MATCH_LEAD, [
            match.workspaceId,
            match.phone,
            match.email,
            name === "" ? null : name,
            match.channel,
            match.origin ?? "live",
        ])
        return rows[0] ?? null
    }

    /** Captures a new customer. */
    async capture(lead: NewLead): Promise<LeadRecordRow> {
        const rows = await this.entityManager.query<Array<LeadRecordRow>>(INSERT_LEAD, [
            lead.workspaceId,
            lead.contactName,
            lead.company,
            lead.channel,
            lead.need,
            lead.phone,
            lead.email,
            lead.origin,
        ])
        const [created] = rows
        if (created === undefined) throw new LeadsError({ code: LeadsErrorCode.NotFound, params: { id: "new" } })
        return created
    }

    /** Adds the phone or the email the lead was missing; one it already has is kept. */
    async fillContact(fill: ContactFill): Promise<void> {
        await this.entityManager.query(FILL_LEAD_CONTACT, [fill.workspaceId, fill.leadId, fill.phone, fill.email])
    }

    /** Stores what the sales AI learned: the stage of an open deal and a context brief the lead did not have. */
    async classify(classification: LeadClassification): Promise<void> {
        await this.entityManager.query(APPLY_CLASSIFICATION, [
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

    /** A confirmed order won the deal, unless it was lost. */
    async markWon(workspaceId: string, leadId: string): Promise<void> {
        await this.entityManager.query(MARK_LEAD_WON, [workspaceId, leadId])
    }

    /** The names of the given leads. */
    namesOf(workspaceId: string, leadIds: ReadonlyArray<string>): Promise<Array<LeadName>> {
        if (leadIds.length === 0) return Promise.resolve([])
        return this.entityManager.query<Array<LeadName>>(FIND_LEAD_NAMES, [workspaceId, leadIds])
    }
}
