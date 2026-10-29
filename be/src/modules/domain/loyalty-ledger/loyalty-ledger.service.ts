import { Injectable } from "@nestjs/common"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { LoyaltyLedgerError, LoyaltyLedgerErrorCode } from "./errors/loyalty-ledger.error"
import type {
    ExpiryEntry,
    LedgerEntry,
    LedgerTotal,
    LoyaltyMember,
    MemberMatch,
    PostParams,
    PostedEntry,
} from "./loyalty-ledger.contracts"
import { LoyaltyLedgerEntity } from "./persistence/entities"
import { toEntry, toExpiryEntry, toMember, toTotal } from "./policies/ledger.mapper"
import type { MemberRaw, TotalRaw } from "./policies/ledger.mapper"

/** The most customers one member list answers. */
const MEMBER_LIMIT = 2000

/** The most rewards one redemption count answers. */
const REWARD_LIMIT = 200

/** The most entries the expiry rule reads for one customer. */
const EXPIRY_LIMIT = 2000

/** The kinds of entry there are, so a totals read is bounded by them. */
const KIND_COUNT = 4

@Injectable()
/** The one way points move: an append-only ledger, idempotent on its key, never taking more than the balance. Balances come from the ledger and nowhere else. */
export class LoyaltyLedgerService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /**
     * Writes one entry under a lock on the customer. A key posted before changes nothing and answers null; taking more points
     * than the balance holds is refused.
     */
    async post(params: PostParams): Promise<PostedEntry> {
        const { manager } = params
        const locked = await manager
            .createQueryBuilder()
            .select("c.id", "id")
            .from("public.loyalty_customers", "c")
            .where("c.id = :customerId AND c.workspace_id = :workspaceId", {
                customerId: params.customerId,
                workspaceId: params.workspaceId,
            })
            .limit(1)
            .setLock("pessimistic_write")
            .getRawOne<{ id: string }>()
        if (locked === undefined) throw new LoyaltyLedgerError({ code: LoyaltyLedgerErrorCode.CustomerNotFound })
        const posted = await manager.exists(LoyaltyLedgerEntity, {
            where: { workspaceId: params.workspaceId, ref: params.ref },
        })
        if (posted) return null
        if (params.points < 0) {
            const balance = await manager
                .createQueryBuilder(LoyaltyLedgerEntity, "l")
                .select("COALESCE(sum(l.points), 0)::int", "points")
                .where("l.customerId = :customerId", { customerId: params.customerId })
                .getRawOne<{ points: number }>()
            if ((balance?.points ?? 0) + params.points < 0)
                throw new LoyaltyLedgerError({ code: LoyaltyLedgerErrorCode.InsufficientPoints })
        }
        const inserted = await manager.insert(LoyaltyLedgerEntity, {
            workspaceId: params.workspaceId,
            customerId: params.customerId,
            kind: params.kind,
            points: params.points,
            ref: params.ref,
            byName: params.by === "" ? "NIVO" : params.by,
            amountVnd: params.amountVnd,
            orderId: params.orderId,
            invoiceId: params.invoiceId,
            rewardId: params.rewardId,
            evidence: params.evidence,
            expiresAt: params.expiresAt === null ? null : new Date(params.expiresAt),
            occurredAt: new Date(params.occurredAt),
        })
        const id: unknown = inserted.identifiers[0]?.id
        if (typeof id !== "string") throw new LoyaltyLedgerError({ code: LoyaltyLedgerErrorCode.NotPosted })
        return id
    }

    /** Whether an idempotency key was posted before. */
    hasRef(workspaceId: string, ref: string): Promise<boolean> {
        return this.entityManager.exists(LoyaltyLedgerEntity, { where: { workspaceId, ref } })
    }

    /** Every customer of a workspace with the balance, newest first. */
    async members(workspaceId: string): Promise<ReadonlyArray<LoyaltyMember>> {
        const rows = await this.memberQuery(workspaceId)
            .orderBy("c.created_at", "DESC")
            .limit(MEMBER_LIMIT)
            .getRawMany<MemberRaw>()
        return rows.map(toMember)
    }

    /** One customer with the balance, or null. */
    async member(workspaceId: string, customerId: string): Promise<MemberMatch> {
        const row = await this.memberQuery(workspaceId)
            .andWhere("c.id = :customerId", { customerId })
            .limit(1)
            .getRawOne<MemberRaw>()
        return row === undefined ? null : toMember(row)
    }

    /** The newest entries of a customer. */
    async timeline(workspaceId: string, customerId: string, limit: number): Promise<ReadonlyArray<LedgerEntry>> {
        const entries = await this.entityManager.find(LoyaltyLedgerEntity, {
            where: { workspaceId, customerId },
            order: { occurredAt: "DESC" },
            take: limit,
        })
        return entries.map(toEntry)
    }

    /** How many times a customer redeemed each reward, by reward id. */
    async redeemedCounts(customerId: string): Promise<ReadonlyMap<string, number>> {
        const rows = await this.entityManager
            .createQueryBuilder(LoyaltyLedgerEntity, "l")
            .select("l.rewardId", "reward_id")
            .addSelect("count(*)::int", "total")
            .where("l.customerId = :customerId AND l.kind = 'redeem' AND l.rewardId IS NOT NULL", { customerId })
            .groupBy("l.rewardId")
            .limit(REWARD_LIMIT)
            .getRawMany<{ reward_id: string; total: number }>()
        return new Map(rows.map((row) => [row.reward_id, row.total]))
    }

    /** The entries that decide which points are still unspent. */
    async expiryEntries(customerId: string): Promise<ReadonlyArray<ExpiryEntry>> {
        const entries = await this.entityManager.find(LoyaltyLedgerEntity, {
            select: { kind: true, points: true, expiresAt: true },
            where: { customerId },
            order: { occurredAt: "ASC" },
            take: EXPIRY_LIMIT,
        })
        return entries.map(toExpiryEntry)
    }

    /** What each kind of entry came to since an instant. */
    async totalsSince(workspaceId: string, sinceIso: string): Promise<ReadonlyArray<LedgerTotal>> {
        const rows = await this.entityManager
            .createQueryBuilder(LoyaltyLedgerEntity, "l")
            .select("l.kind", "kind")
            .addSelect("count(*)::int", "entries")
            .addSelect("COALESCE(sum(l.points), 0)::int", "points")
            .addSelect("COALESCE(sum(l.amount_vnd), 0)::float8", "amount_vnd")
            .where("l.workspaceId = :workspaceId AND l.occurredAt >= :since", {
                workspaceId,
                since: new Date(sinceIso),
            })
            .groupBy("l.kind")
            .limit(KIND_COUNT)
            .getRawMany<TotalRaw>()
        return rows.map(toTotal)
    }

    /** The customers of a workspace with the balances the ledger gives them (the customers belong to another capability). */
    private memberQuery(workspaceId: string): SelectQueryBuilder<object> {
        return this.entityManager
            .createQueryBuilder()
            .select("c.id", "id")
            .addSelect("c.name", "name")
            .addSelect("c.phone", "phone")
            .addSelect("c.email", "email")
            .addSelect("c.birthday::text", "birthday")
            .addSelect("c.tier_key", "tier_key")
            .addSelect("c.joined_at", "joined_at")
            .addSelect("c.note", "note")
            .addSelect("COALESCE(sum(l.points), 0)::int", "points")
            .addSelect("COALESCE(sum(l.amount_vnd) FILTER (WHERE l.kind = 'earn'), 0)::float8", "lifetime_spend_vnd")
            .addSelect("(count(l.id) FILTER (WHERE l.kind = 'earn' AND l.order_id IS NOT NULL))::int", "visits")
            .addSelect("max(l.occurred_at) FILTER (WHERE l.kind = 'earn')", "last_visit_at")
            .from("public.loyalty_customers", "c")
            .leftJoin(LoyaltyLedgerEntity, "l", "l.customer_id = c.id")
            .where("c.workspace_id = :workspaceId", { workspaceId })
            .groupBy("c.id")
    }
}
