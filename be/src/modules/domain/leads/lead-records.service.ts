import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { LeadsError, LeadsErrorCode } from "./errors/leads.error"
import type { LeadClassification, LeadMatch, LeadName, NewLead, OptionalLeadRecord } from "./lead-records.contracts"
import type { LeadRecord } from "./persistence/lead-records.rows"
import {
    APPLY_CLASSIFICATION,
    FILL_LEAD_CONTACT,
    FIND_LEAD,
    FIND_LEAD_NAMES,
    INSERT_LEAD,
    MARK_LEAD_WON,
    MATCH_LEAD,
} from "./persistence/lead-records.sql"

@Injectable()
/** The customers of a workspace as the engine finds, captures and classifies them. */
export class LeadRecordsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The lead of the workspace, or null when there is none with that id. */
    async find(workspaceId: string, leadId: string): Promise<OptionalLeadRecord> {
        const rows = await this.entityManager.query<Array<LeadRecord>>(FIND_LEAD, [workspaceId, leadId])
        return rows[0] ?? null
    }

    /** The lead of the workspace; refused when there is none. */
    async require(workspaceId: string, leadId: string): Promise<LeadRecord> {
        const lead = await this.find(workspaceId, leadId)
        if (lead === null) throw new LeadsError({ code: LeadsErrorCode.NotFound, params: { id: leadId } })
        return lead
    }

    /** The customer an input belongs to: by phone, then email, then exact name and channel when the input has no contact at all. */
    async match(match: LeadMatch): Promise<OptionalLeadRecord> {
        const name = match.name?.trim() ?? ""
        const rows = await this.entityManager.query<Array<LeadRecord>>(MATCH_LEAD, [
            match.workspaceId,
            match.phone,
            match.email,
            name === "" ? null : name,
            match.channel,
        ])
        return rows[0] ?? null
    }

    /** Captures a new customer. */
    async capture(lead: NewLead): Promise<LeadRecord> {
        const rows = await this.entityManager.query<Array<LeadRecord>>(INSERT_LEAD, [
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
    async fillContact(workspaceId: string, leadId: string, phone: string | null, email: string | null): Promise<void> {
        await this.entityManager.query(FILL_LEAD_CONTACT, [workspaceId, leadId, phone, email])
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
