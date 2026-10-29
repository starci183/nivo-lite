import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { LoyaltyCustomersService } from "@modules/domain/loyalty-customers"
import type { LoyaltyCustomer } from "@modules/domain/loyalty-customers"
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
import type { BalanceRaw, TotalRaw } from "./policies/ledger.mapper"

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
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly customers: LoyaltyCustomersService,
    ) {}

    /**
     * Writes one entry under a lock on the customer. A key posted before changes nothing and answers null; taking more points
     * than the balance holds is refused.
     */
    async post(params: PostParams): Promise<PostedEntry> {
        const { manager } = params
        const locked = await this.customers.lockOwn(manager, params.workspaceId, params.customerId)
        if (!locked) throw new LoyaltyLedgerError({ code: LoyaltyLedgerErrorCode.CustomerNotFound })
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

    /** Whether any ledger entry refers to the reward. */
    rewardUsed(rewardId: string): Promise<boolean> {
        return this.entityManager.exists(LoyaltyLedgerEntity, { where: { rewardId } })
    }

    /** Whether an idempotency key was posted before. */
    hasRef(workspaceId: string, ref: string): Promise<boolean> {
        return this.entityManager.exists(LoyaltyLedgerEntity, { where: { workspaceId, ref } })
    }

    /** Every customer of a workspace with the balance, newest first. */
    async members(workspaceId: string): Promise<ReadonlyArray<LoyaltyMember>> {
        return this.withBalances(workspaceId, await this.customers.listNewest(workspaceId, MEMBER_LIMIT))
    }

    /** One customer with the balance, or null. */
    async member(workspaceId: string, customerId: string): Promise<MemberMatch> {
        const customer = await this.customers.byId(workspaceId, customerId)
        if (customer === null) return null
        return toMember(customer, (await this.balancesOf(workspaceId, [customer.id])).get(customer.id))
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

    /** The customers as members: each with the balances its ledger entries give it (a customer without entries holds nothing). */
    private async withBalances(
        workspaceId: string,
        customers: ReadonlyArray<LoyaltyCustomer>,
    ): Promise<Array<LoyaltyMember>> {
        if (customers.length === 0) return []
        const balances = await this.balancesOf(
            workspaceId,
            customers.map((customer) => customer.id),
        )
        return customers.map((customer) => toMember(customer, balances.get(customer.id)))
    }

    /** What the ledger entries of each customer come to, by customer id. */
    private async balancesOf(
        workspaceId: string,
        customerIds: ReadonlyArray<string>,
    ): Promise<Map<string, BalanceRaw>> {
        const rows = await this.entityManager
            .createQueryBuilder(LoyaltyLedgerEntity, "l")
            .select("l.customerId", "customer_id")
            .addSelect("COALESCE(sum(l.points), 0)::int", "points")
            .addSelect("COALESCE(sum(l.amountVnd) FILTER (WHERE l.kind = 'earn'), 0)::float8", "lifetime_spend_vnd")
            .addSelect("(count(l.id) FILTER (WHERE l.kind = 'earn' AND l.orderId IS NOT NULL))::int", "visits")
            .addSelect("max(l.occurredAt) FILTER (WHERE l.kind = 'earn')", "last_visit_at")
            .where("l.workspaceId = :workspaceId AND l.customerId = ANY(:customerIds)", {
                workspaceId,
                customerIds: [...customerIds],
            })
            .groupBy("l.customerId")
            .getRawMany<BalanceRaw>()
        return new Map(rows.map((row) => [row.customer_id, row]))
    }
}
