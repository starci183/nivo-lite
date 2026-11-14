import { Injectable } from "@nestjs/common"
import { In, type EntityManager, type SelectQueryBuilder } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    ChannelDeliveryStore,
    DeliveryClaim,
    DeliveryRows,
    DeliverySettle,
    StoredDelivery,
} from "./channel-delivery-store.port"
import type { DeliveryState } from "./delivery.policy"
import { ofLiveContact } from "./live-contact.policy"
import { CustomerMessageEntity } from "./persistence/entities"

/** The direction of every row this store reads and writes: what was said to the person. */
const TOLD = "to_person"

const stateOf = (value: string | null): DeliveryState => {
    if (value === "claimed" || value === "delivered" || value === "refused" || value === "unknown") return value
    // The table's check keeps the four states on a sent line; a row outside them is answered as an outcome nobody knows, never as delivered.
    return "unknown"
}

const deliveryOf = (row: CustomerMessageEntity): StoredDelivery => ({
    id: row.id,
    seq: row.seq,
    sendKey: row.lineKey,
    routeId: row.routeId,
    contactId: row.contactId,
    agentId: row.agentId,
    runId: row.runId,
    stepKey: row.stepKey,
    text: row.text,
    attachmentCount: row.attachmentCount,
    attachmentKinds: [...row.attachmentKinds],
    state: stateOf(row.state),
    reason: row.reason,
    providerMessageId: row.providerMessageId,
    channel: row.channel,
    accountId: row.accountId,
    createdAt: row.createdAt.toISOString(),
    deliveredAt: row.deliveredAt === null ? null : row.deliveredAt.toISOString(),
})

@Injectable()
/**
 * The delivery ledger on public.customer_messages (the `to_person` lines), on the primary connection; every write is one statement. No
 * raw SQL. A claim IS the line: what was said to the person is written here once, by the send, and nowhere else.
 */
export class TypeormChannelDeliveryStore implements ChannelDeliveryStore {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The row of a send key, or null. */
    async byKey(workspaceId: string, sendKey: string): Promise<StoredDelivery | null> {
        const row = await this.entityManager.findOne(CustomerMessageEntity, { where: { workspaceId, direction: TOLD, lineKey: sendKey } })
        return row === null ? null : deliveryOf(row)
    }

    /** Writes the claimed row of a send key once: true when this call wrote it. Said at the claim (the database's clock). */
    async insertClaimed(workspaceId: string, claim: DeliveryClaim): Promise<boolean> {
        const result = await this.entityManager
            .createQueryBuilder(CustomerMessageEntity, "line")
            .insert()
            .values({
                workspaceId,
                direction: TOLD,
                lineKey: claim.sendKey,
                saidAt: () => "now()",
                routeId: claim.routeId,
                contactId: claim.contactId,
                agentId: claim.agentId,
                memberId: claim.memberId ?? null,
                runId: claim.runId,
                stepKey: claim.stepKey,
                text: claim.text,
                files: [...(claim.files ?? [])],
                attachmentCount: claim.attachmentCount,
                attachmentKinds: [...claim.attachmentKinds],
                orderCard: claim.order ?? null,
                eventId: null,
                state: "claimed",
                reason: null,
                providerMessageId: null,
                channel: claim.channel,
                accountId: claim.accountId,
                deliveredAt: null,
            })
            .orIgnore()
            .returning(["id"])
            .execute()
        // Postgres answers the inserted rows: none when another try claimed the key first.
        const returned: unknown = result.raw
        return Array.isArray(returned) && returned.length > 0
    }

    /** Takes a row in one of the `from` states back to claimed: true when this call moved it. */
    async reclaim(workspaceId: string, sendKey: string, from: ReadonlyArray<"refused" | "unknown">): Promise<boolean> {
        const result = await this.entityManager.update(
            CustomerMessageEntity,
            { workspaceId, direction: TOLD, lineKey: sendKey, state: In([...from]) },
            { state: "claimed", reason: null },
        )
        return (result.affected ?? 0) > 0
    }

    /** Settles a row that is not delivered: true when a row moved. */
    async settle(workspaceId: string, sendKey: string, values: DeliverySettle): Promise<boolean> {
        const result = await this.entityManager.update(
            CustomerMessageEntity,
            { workspaceId, direction: TOLD, lineKey: sendKey, state: In(["claimed", "refused", "unknown"]) },
            {
                state: values.state,
                reason: values.reason,
                providerMessageId: values.providerMessageId,
                deliveredAt: values.deliveredAt,
            },
        )
        return (result.affected ?? 0) > 0
    }

    /** The rows of one route, newest first (a deleted contact's rows are left out). */
    ofRoute(workspaceId: string, routeId: string, limit: number, after: string | null): Promise<DeliveryRows> {
        return this.page(this.told(workspaceId).andWhere("line.routeId = :routeId", { routeId }), limit, after)
    }

    /** The rows of one run step (every state), newest first (a deleted contact's rows are left out). */
    async ofStep(workspaceId: string, runId: string, stepKey: string, limit: number): Promise<ReadonlyArray<StoredDelivery>> {
        const rows = await this.told(workspaceId)
            .andWhere("line.runId = :runId", { runId })
            .andWhere("line.stepKey = :stepKey", { stepKey })
            .orderBy("line.seq", "DESC")
            .limit(limit)
            .getMany()
        return rows.map((row) => deliveryOf(row))
    }

    /** The rows delivered in the window, counted (a deleted contact's rows are not counted). */
    countDelivered(workspaceId: string, from: Date, to: Date): Promise<number> {
        return this.told(workspaceId)
            .andWhere("line.state = 'delivered'")
            .andWhere("line.deliveredAt >= :from AND line.deliveredAt < :to", { from, to })
            .getCount()
    }

    /** The distinct routes of the rows delivered in the window, counted (a deleted contact's routes are not counted). */
    async countRoutesTold(workspaceId: string, from: Date, to: Date): Promise<number> {
        const row = await this.told(workspaceId)
            .select("COUNT(DISTINCT line.routeId)", "total")
            .andWhere("line.state = 'delivered'")
            .andWhere("line.deliveredAt >= :from AND line.deliveredAt < :to", { from, to })
            .getRawOne<{ total: string }>()
        return Number(row?.total ?? 0)
    }

    /** The rows of the contact ids, newest first (a deleted contact's rows are left out). */
    ofContacts(
        workspaceId: string,
        contactIds: ReadonlyArray<string>,
        limit: number,
        after: string | null,
    ): Promise<DeliveryRows> {
        if (contactIds.length === 0) return Promise.resolve({ rows: [], next: null })
        return this.page(this.told(workspaceId).andWhere("line.contactId IN (:...contactIds)", { contactIds: [...contactIds] }), limit, after)
    }

    /**
     * Every thread read starts here: the sent lines of the workspace whose contact is not deleted (soft delete, R31: the rows stay, reads
     * skip them). The send fence (`byKey`, the claim, `reclaim`, `settle`) does NOT: it is the once-per-send-key guard the unique index
     * backs, and it never lists a person's lines.
     */
    private told(workspaceId: string): SelectQueryBuilder<CustomerMessageEntity> {
        return ofLiveContact(this.entityManager.createQueryBuilder(CustomerMessageEntity, "line"), "line")
            .where("line.workspaceId = :workspaceId", { workspaceId })
            .andWhere("line.direction = 'to_person'")
    }

    /** One page by insertion order, newest first: one row more than asked tells whether another page follows. */
    private async page(query: SelectQueryBuilder<CustomerMessageEntity>, limit: number, after: string | null): Promise<DeliveryRows> {
        if (after !== null) query.andWhere("line.seq < :after", { after })
        const rows = await query.orderBy("line.seq", "DESC").limit(limit + 1).getMany()
        const kept = rows.slice(0, limit).map((row) => deliveryOf(row))
        const last = kept.at(-1)
        return { rows: kept, next: rows.length > limit && last !== undefined ? last.seq : null }
    }
}
