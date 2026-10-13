import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { CustomerMatch, LeadContact, MaybeText, NewLoyaltyCustomer } from "./loyalty-customers.contracts"
import {
    INSERT_CUSTOMER,
    INSERT_CUSTOMERS_FROM_LEADS,
    SELECT_CUSTOMER_BY_ID,
    SELECT_CUSTOMER_BY_PHONE,
    SELECT_LEAD_CONTACTS,
    UPDATE_CUSTOMER_TIER,
} from "./persistence/loyalty-customers.sql"
import { toCustomer, toLeadContact } from "./persistence/loyalty-customers.rows"
import type { CustomerRow, LeadContactRow } from "./persistence/loyalty-customers.rows"

/** A move of a customer to another tier. */
export interface TierMove {
    /** The transaction the move joins. */
    readonly manager: EntityManager
    /** The workspace. */
    readonly workspaceId: string
    /** The customer. */
    readonly customerId: string
    /** The tier to hold from now. */
    readonly toKey: string
    /** The tier the customer is expected to hold now, or null for none. */
    readonly fromKey: MaybeText
    /** The instant of the move. */
    readonly nowIso: string
}

@Injectable()
/** The people of the loyalty programme: found by phone or id, created when a purchase or a lead names them, moved up the ladder. */
export class LoyaltyCustomersService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The customer with a normalised phone, or null. */
    async byPhone(workspaceId: string, phone: string): Promise<CustomerMatch> {
        const [row] = await this.entityManager.query<Array<CustomerRow>>(SELECT_CUSTOMER_BY_PHONE, [workspaceId, phone])
        return row === undefined ? null : toCustomer(row)
    }

    /** The customer with an id in the workspace, or null. */
    async byId(workspaceId: string, customerId: string): Promise<CustomerMatch> {
        const [row] = await this.entityManager.query<Array<CustomerRow>>(SELECT_CUSTOMER_BY_ID, [
            workspaceId,
            customerId,
        ])
        return row === undefined ? null : toCustomer(row)
    }

    /** The customer of a phone, created when the phone is new; a concurrent request that created it first is found again. */
    async ensureByPhone(manager: EntityManager, person: NewLoyaltyCustomer): Promise<MaybeText> {
        const [existing] = await manager.query<Array<CustomerRow>>(SELECT_CUSTOMER_BY_PHONE, [
            person.workspaceId,
            person.phone,
        ])
        if (existing !== undefined) return existing.id
        const [created] = await manager.query<Array<{ id: string }>>(INSERT_CUSTOMER, [
            person.workspaceId,
            person.name,
            person.phone,
            person.email,
        ])
        if (created !== undefined) return created.id
        const [raced] = await manager.query<Array<CustomerRow>>(SELECT_CUSTOMER_BY_PHONE, [
            person.workspaceId,
            person.phone,
        ])
        return raced === undefined ? null : raced.id
    }

    /** Moves a customer to a tier unless somebody moved it first; true when this call moved it. */
    async moveTier(move: TierMove): Promise<boolean> {
        const rows = await move.manager.query<Array<{ id: string }>>(UPDATE_CUSTOMER_TIER, [
            move.workspaceId,
            move.customerId,
            move.toKey,
            move.fromKey,
            move.nowIso,
        ])
        return rows.length > 0
    }

    /** The leads of a workspace that carry a usable phone or email. */
    async leadContacts(workspaceId: string): Promise<ReadonlyArray<LeadContact>> {
        const rows = await this.entityManager.query<Array<LeadContactRow>>(SELECT_LEAD_CONTACTS, [workspaceId])
        return rows.map(toLeadContact).filter((lead) => lead.phone !== null || lead.email !== null)
    }

    /** Makes customers of the leads that are not customers yet; answers how many were created. */
    async createFromLeads(
        manager: EntityManager,
        workspaceId: string,
        leads: ReadonlyArray<LeadContact>,
    ): Promise<number> {
        if (leads.length === 0) return 0
        const created = await manager.query<Array<{ id: string }>>(INSERT_CUSTOMERS_FROM_LEADS, [
            workspaceId,
            leads.map((lead) => lead.name),
            leads.map((lead) => lead.phone),
            leads.map((lead) => lead.email),
        ])
        return created.length
    }
}
