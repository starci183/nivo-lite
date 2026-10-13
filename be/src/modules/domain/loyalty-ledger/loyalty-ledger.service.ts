import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
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
import {
    COUNT_REDEEMED,
    INSERT_ENTRY,
    LOCK_CUSTOMER,
    SELECT_BALANCE,
    SELECT_ENTRY_BY_REF,
    SELECT_EXPIRY_ENTRIES,
    SELECT_MEMBER,
    SELECT_MEMBERS,
    SELECT_TIMELINE,
    SELECT_TOTALS_SINCE,
} from "./persistence/loyalty-ledger.sql"
import { toEntry, toExpiryEntry, toMember, toTotal } from "./persistence/loyalty-ledger.rows"
import type { EntryRow, ExpiryRow, MemberRow, TotalRow } from "./persistence/loyalty-ledger.rows"

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
        const locked = await manager.query<Array<{ id: string }>>(LOCK_CUSTOMER, [
            params.customerId,
            params.workspaceId,
        ])
        if (locked.length === 0) throw new LoyaltyLedgerError({ code: LoyaltyLedgerErrorCode.CustomerNotFound })
        const posted = await manager.query<Array<{ id: string }>>(SELECT_ENTRY_BY_REF, [params.workspaceId, params.ref])
        if (posted.length > 0) return null
        if (params.points < 0) {
            const balances = await manager.query<Array<{ points: number }>>(SELECT_BALANCE, [params.customerId])
            const held = balances.reduce((sum, row) => sum + row.points, 0)
            if (held + params.points < 0)
                throw new LoyaltyLedgerError({ code: LoyaltyLedgerErrorCode.InsufficientPoints })
        }
        const [row] = await manager.query<Array<{ id: string }>>(INSERT_ENTRY, [
            params.workspaceId,
            params.customerId,
            params.kind,
            params.points,
            params.ref,
            params.by,
            params.amountVnd,
            params.orderId,
            params.invoiceId,
            params.rewardId,
            params.evidence,
            params.expiresAt,
            params.occurredAt,
        ])
        if (row === undefined) throw new LoyaltyLedgerError({ code: LoyaltyLedgerErrorCode.NotPosted })
        return row.id
    }

    /** Whether an idempotency key was posted before. */
    async hasRef(workspaceId: string, ref: string): Promise<boolean> {
        const rows = await this.entityManager.query<Array<{ id: string }>>(SELECT_ENTRY_BY_REF, [workspaceId, ref])
        return rows.length > 0
    }

    /** Every customer of a workspace with the balance, newest first. */
    async members(workspaceId: string): Promise<ReadonlyArray<LoyaltyMember>> {
        const rows = await this.entityManager.query<Array<MemberRow>>(SELECT_MEMBERS, [workspaceId])
        return rows.map(toMember)
    }

    /** One customer with the balance, or null. */
    async member(workspaceId: string, customerId: string): Promise<MemberMatch> {
        const [row] = await this.entityManager.query<Array<MemberRow>>(SELECT_MEMBER, [workspaceId, customerId])
        return row === undefined ? null : toMember(row)
    }

    /** The newest entries of a customer. */
    async timeline(workspaceId: string, customerId: string, limit: number): Promise<ReadonlyArray<LedgerEntry>> {
        const rows = await this.entityManager.query<Array<EntryRow>>(SELECT_TIMELINE, [workspaceId, customerId, limit])
        return rows.map(toEntry)
    }

    /** How many times a customer redeemed each reward, by reward id. */
    async redeemedCounts(customerId: string): Promise<ReadonlyMap<string, number>> {
        const rows = await this.entityManager.query<Array<{ reward_id: string; total: number }>>(COUNT_REDEEMED, [
            customerId,
        ])
        return new Map(rows.map((row) => [row.reward_id, row.total]))
    }

    /** The entries that decide which points are still unspent. */
    async expiryEntries(customerId: string): Promise<ReadonlyArray<ExpiryEntry>> {
        const rows = await this.entityManager.query<Array<ExpiryRow>>(SELECT_EXPIRY_ENTRIES, [customerId])
        return rows.map(toExpiryEntry)
    }

    /** What each kind of entry came to since an instant. */
    async totalsSince(workspaceId: string, sinceIso: string): Promise<ReadonlyArray<LedgerTotal>> {
        const rows = await this.entityManager.query<Array<TotalRow>>(SELECT_TOTALS_SINCE, [workspaceId, sinceIso])
        return rows.map(toTotal)
    }
}
