import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    CustomerMatch,
    CustomerPatch,
    LeadContact,
    MaybeText,
    NewLoyaltyCustomer,
} from "./loyalty-customers.contracts"
import { customerBirthday } from "./policies/customer-birthday.policy"
import { toCustomer, toLeadContact } from "./policies/customer.mapper"
import type { LeadContactRaw } from "./policies/customer.mapper"
import { LoyaltyCustomerEntity } from "./persistence/entities"

/** The most leads one read answers. */
const LEAD_LIMIT = 2000

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
        const row = await this.entityManager.findOne(LoyaltyCustomerEntity, { where: { workspaceId, phone } })
        return row === null ? null : toCustomer(row)
    }

    /** The customer with an id in the workspace, or null. */
    async byId(workspaceId: string, customerId: string): Promise<CustomerMatch> {
        const row = await this.entityManager.findOne(LoyaltyCustomerEntity, { where: { workspaceId, id: customerId } })
        return row === null ? null : toCustomer(row)
    }

    /** The customer of a phone, created when the phone is new; a concurrent request that created it first is found again. */
    async ensureByPhone(manager: EntityManager, person: NewLoyaltyCustomer): Promise<MaybeText> {
        const existing = await this.idOfPhone(manager, person.workspaceId, person.phone)
        if (existing !== null) return existing
        const created = await manager
            .createQueryBuilder(LoyaltyCustomerEntity, "lc")
            .insert()
            .values({ workspaceId: person.workspaceId, name: person.name, phone: person.phone, email: person.email })
            .orIgnore()
            .returning("id")
            .execute()
        const id = (created.raw as Array<{ id: string }>)[0]?.id
        if (id !== undefined) return id
        return this.idOfPhone(manager, person.workspaceId, person.phone)
    }

    /** Moves a customer to a tier unless somebody moved it first; true when this call moved it. */
    async moveTier(move: TierMove): Promise<boolean> {
        const at = new Date(move.nowIso)
        const moved = await move.manager
            .createQueryBuilder(LoyaltyCustomerEntity, "lc")
            .update()
            .set({ tierKey: move.toKey, tierSince: at, updatedAt: at })
            .where("workspace_id = :workspaceId AND id = :customerId AND tier_key IS NOT DISTINCT FROM :fromKey", {
                workspaceId: move.workspaceId,
                customerId: move.customerId,
                fromKey: move.fromKey,
            })
            .returning("id")
            .execute()
        return (moved.raw as Array<unknown>).length > 0
    }

    /** The leads of a workspace that carry a usable phone or email. */
    async leadContacts(workspaceId: string): Promise<ReadonlyArray<LeadContact>> {
        const rows = await this.entityManager
            .createQueryBuilder()
            .select("l.id", "id")
            .addSelect("l.contact_name", "contact_name")
            .addSelect("l.phone", "phone")
            .addSelect("l.email", "email")
            .from("public.leads", "l")
            .where("l.workspace_id = :workspaceId AND (l.phone IS NOT NULL OR l.email IS NOT NULL)", { workspaceId })
            .orderBy("l.created_at", "ASC")
            .limit(LEAD_LIMIT)
            .getRawMany<LeadContactRaw>()
        return rows.map(toLeadContact).filter((lead) => lead.phone !== null || lead.email !== null)
    }

    /** Makes customers of the leads that are not customers yet; answers how many were created. */
    async createFromLeads(
        manager: EntityManager,
        workspaceId: string,
        leads: ReadonlyArray<LeadContact>,
    ): Promise<number> {
        if (leads.length === 0) return 0
        const result = await manager
            .createQueryBuilder(LoyaltyCustomerEntity, "lc")
            .insert()
            .values(leads.map((lead) => ({ workspaceId, name: lead.name, phone: lead.phone, email: lead.email })))
            .orIgnore()
            .returning("id")
            .execute()
        return (result.raw as Array<unknown>).length
    }

    /** Changes the profile fields of a customer within a workspace, without moving their points or tier. */
    async updateProfile(workspaceId: string, customerId: string, patch: CustomerPatch): Promise<boolean> {
        const name = patch.name?.trim().slice(0, 120) || null
        const note = patch.note?.trim().slice(0, 500) ?? null
        const changed = await this.entityManager
            .createQueryBuilder(LoyaltyCustomerEntity, "lc")
            .update()
            .set({
                ...(name === null ? {} : { name }),
                ...(patch.birthday === undefined ? {} : { birthday: customerBirthday(patch.birthday) }),
                ...(note === null ? {} : { note }),
                updatedAt: () => "now()",
            })
            .where("workspace_id = :workspaceId AND id = :customerId", { workspaceId, customerId })
            .returning("id")
            .execute()
        return (changed.raw as Array<unknown>).length > 0
    }

    /** The customer id of a phone; a missing phone matches nobody (a null in a TypeORM where is ignored, never `IS NULL`). */
    private async idOfPhone(manager: EntityManager, workspaceId: string, phone: string | null): Promise<MaybeText> {
        if (phone === null) return null
        const found = await manager.findOne(LoyaltyCustomerEntity, {
            select: { id: true },
            where: { workspaceId, phone },
        })
        return found === null ? null : found.id
    }
}
