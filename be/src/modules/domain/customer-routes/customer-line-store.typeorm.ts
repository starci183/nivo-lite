import { Injectable } from "@nestjs/common"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    CustomerLine,
    CustomerLineRows,
    CustomerLineStore,
    HeardLineRow,
    LineWindowAsk,
} from "./customer-line-store.port"
import type { DeliveryState } from "./delivery.policy"
import { CustomerRoutesError, CustomerRoutesErrorCode } from "./errors/customer-routes.error"
import { ofLiveContact } from "./live-contact.policy"
import { CustomerMessageEntity } from "./persistence/entities"

const HEARD = "from_person"

const stateOf = (row: CustomerMessageEntity): DeliveryState | null => {
    if (row.direction === HEARD) return null
    const value = row.state
    if (value === "claimed" || value === "delivered" || value === "refused" || value === "unknown") return value
    // The table's check keeps the four states on a sent line; a row outside them is an outcome nobody knows, never delivered.
    return "unknown"
}

const lineOf = (row: CustomerMessageEntity): CustomerLine => ({
    id: row.id,
    seq: row.seq,
    routeId: row.routeId,
    contactId: row.contactId,
    direction: row.direction === HEARD ? "from_person" : "to_person",
    key: row.lineKey,
    saidAt: row.saidAt.toISOString(),
    text: row.text,
    files: row.files.map((file) => ({ ...file })),
    order: row.orderCard === null ? null : { ...row.orderCard },
    eventId: row.eventId,
    agentId: row.agentId,
    memberId: row.memberId,
    runId: row.runId,
    stepKey: row.stepKey,
    state: stateOf(row),
    reason: row.reason,
    channel: row.channel,
    accountId: row.accountId,
    deliveredAt: row.deliveredAt === null ? null : row.deliveredAt.toISOString(),
})

const isIdRow = (value: unknown): value is { readonly id: string } =>
    typeof value === "object" && value !== null && "id" in value && typeof value.id === "string"

@Injectable()
/**
 * The lines of the conversations on public.customer_messages, both directions, on the primary connection (a heard line in the caller's
 * transaction). Every write is one statement; the thread is read newest first by said-at then insertion order. No raw SQL.
 */
export class TypeormCustomerLineStore implements CustomerLineStore {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Writes a heard line once on its route: an insert-or-nothing; a line heard before answers its id. */
    async insertHeard(
        manager: EntityManager,
        workspaceId: string,
        line: HeardLineRow,
    ): Promise<{ readonly id: string; readonly written: boolean }> {
        const result = await manager
            .createQueryBuilder(CustomerMessageEntity, "line")
            .insert()
            .values({
                workspaceId,
                direction: HEARD,
                lineKey: line.key,
                saidAt: line.saidAt,
                routeId: line.routeId,
                contactId: line.contactId,
                text: line.text,
                files: line.files.map((file) => ({ ...file })),
                attachmentCount: line.files.length,
                attachmentKinds: [],
                orderCard: null,
                eventId: line.eventId,
                agentId: null,
                memberId: null,
                runId: null,
                stepKey: null,
                state: null,
                reason: null,
                providerMessageId: null,
                channel: line.channel,
                accountId: line.accountId,
                deliveredAt: null,
            })
            .orIgnore()
            .returning(["id"])
            .execute()
        const returned: unknown = result.raw
        const [inserted] = Array.isArray(returned) ? returned : []
        if (isIdRow(inserted)) return { id: inserted.id, written: true }
        const kept = await manager.findOne(CustomerMessageEntity, {
            where: { workspaceId, direction: HEARD, routeId: line.routeId, lineKey: line.key },
        })
        if (kept === null) throw new CustomerRoutesError({ code: CustomerRoutesErrorCode.LineMissing })
        return { id: kept.id, written: false }
    }

    /** The lines of the routes, newest first. */
    windowOf(workspaceId: string, routeIds: ReadonlyArray<string>, ask: LineWindowAsk): Promise<CustomerLineRows> {
        if (routeIds.length === 0) return Promise.resolve({ rows: [], next: null })
        return this.page(this.base(workspaceId).andWhere("line.routeId IN (:...routeIds)", { routeIds: [...routeIds] }), ask)
    }

    /** The lines of the contact ids, newest first. */
    ofContacts(workspaceId: string, contactIds: ReadonlyArray<string>, ask: LineWindowAsk): Promise<CustomerLineRows> {
        if (contactIds.length === 0) return Promise.resolve({ rows: [], next: null })
        return this.page(this.base(workspaceId).andWhere("line.contactId IN (:...contactIds)", { contactIds: [...contactIds] }), ask)
    }

    /** When the person last said something on the route (a deleted contact's lines are left out). */
    async lastHeardAt(workspaceId: string, routeId: string): Promise<Date | null> {
        const row = await this.base(workspaceId)
            .andWhere("line.routeId = :routeId", { routeId })
            .andWhere("line.direction = 'from_person'")
            .orderBy("line.saidAt", "DESC")
            .addOrderBy("line.seq", "DESC")
            .getOne()
        return row === null ? null : row.saidAt
    }

    /** Every read starts here: the lines of the workspace whose contact is not deleted (soft delete, R31: the rows stay, reads skip them). */
    private base(workspaceId: string): SelectQueryBuilder<CustomerMessageEntity> {
        return ofLiveContact(this.entityManager.createQueryBuilder(CustomerMessageEntity, "line"), "line").where(
            "line.workspaceId = :workspaceId",
            { workspaceId },
        )
    }

    /** One page, newest first: one row more than asked tells whether an older page follows. */
    private async page(query: SelectQueryBuilder<CustomerMessageEntity>, ask: LineWindowAsk): Promise<CustomerLineRows> {
        if (ask.since !== null) query.andWhere("line.saidAt >= :since", { since: ask.since })
        if (ask.before !== null)
            query.andWhere("(line.saidAt < :beforeAt OR (line.saidAt = :beforeAt AND line.seq < :beforeSeq))", {
                beforeAt: ask.before.saidAt,
                beforeSeq: ask.before.seq,
            })
        if (ask.toldStates?.length === 0) query.andWhere("line.direction = 'from_person'")
        else if (ask.toldStates !== null)
            query.andWhere("(line.direction = 'from_person' OR line.state IN (:...toldStates))", { toldStates: [...ask.toldStates] })
        const rows = await query
            .orderBy("line.saidAt", "DESC")
            .addOrderBy("line.seq", "DESC")
            .limit(ask.limit + 1)
            .getMany()
        const kept = rows.slice(0, ask.limit)
        const last = kept.at(-1)
        return {
            rows: kept.map((row) => lineOf(row)),
            next: rows.length > ask.limit && last !== undefined ? { saidAt: last.saidAt, seq: last.seq } : null,
        }
    }
}
