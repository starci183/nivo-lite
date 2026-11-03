import { Injectable } from "@nestjs/common"
import { In, LessThanOrEqual } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager, returnedRows, rowShape } from "@modules/platform/database"
import type { NewPaymentClaim, PaymentClaimRow, PaymentClaimWhere } from "./orders.contracts"
import { PaymentClaimEntity } from "./persistence/entities"

/** The most open claims one read returns. */
const OPEN_LIMIT = 100

/** The row an insert answers with `RETURNING id`. */
const isWrittenId = rowShape({ id: "string" })

const toRow = (claim: PaymentClaimEntity): PaymentClaimRow => ({
    id: claim.id,
    workspaceId: claim.workspaceId,
    leadId: claim.leadId,
    conversationId: claim.conversationId,
    amountVnd: claim.amountVnd,
    names: claim.names,
    body: claim.body,
    claimedAt: claim.claimedAt,
    status: claim.status,
})

@Injectable()
/** The ledger of what customers said about paying an order: the only writer of public.payment_claims. A claim waits open until a credit settles it or the wait runs out. */
export class OrderPaymentClaimsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Writes the claim and answers its id; the same message again answers the id of the claim already written. */
    async record(claim: NewPaymentClaim): Promise<string> {
        const inserted = await this.entityManager
            .createQueryBuilder(PaymentClaimEntity, "c")
            .insert()
            .values({ ...claim, names: [...claim.names] })
            .orIgnore()
            .returning("id")
            .execute()
        const [written] = returnedRows(inserted.raw, isWrittenId)
        if (written !== undefined) return written.id
        const existing = await this.entityManager.findOneOrFail(PaymentClaimEntity, {
            where: { workspaceId: claim.workspaceId, dedupeKey: claim.dedupeKey },
        })
        return existing.id
    }

    /** The claims of the workspace that match the equalities, newest first. */
    async query(workspaceId: string, where: PaymentClaimWhere, limit: number): Promise<Array<PaymentClaimRow>> {
        const claims = await this.entityManager.find(PaymentClaimEntity, {
            where: { workspaceId, ...where },
            order: { claimedAt: "DESC" },
            take: Math.min(limit, OPEN_LIMIT),
        })
        return claims.map(toRow)
    }

    /** The claims of the workspace that still wait for money, oldest first. */
    async openOf(workspaceId: string): Promise<Array<PaymentClaimRow>> {
        const claims = await this.entityManager.find(PaymentClaimEntity, {
            where: { workspaceId, status: "open" },
            order: { claimedAt: "ASC" },
            take: OPEN_LIMIT,
        })
        return claims.map(toRow)
    }

    /** Settles the open claims named, in the caller's transaction, with the transaction that paid (none when a person confirmed it from the bank). */
    async settle(
        workspaceId: string,
        claimIds: ReadonlyArray<string>,
        transactionId: string | null,
        manager: EntityManager = this.entityManager,
    ): Promise<void> {
        if (claimIds.length === 0) return
        await manager.update(
            PaymentClaimEntity,
            { workspaceId, id: In([...claimIds]), status: "open" },
            { status: "settled", settledTransactionId: transactionId },
        )
    }

    /** The open claims of any workspace that were made at or before the instant: the ones whose wait ran out. */
    async overdue(before: Date, limit: number): Promise<Array<PaymentClaimRow>> {
        const claims = await this.entityManager.find(PaymentClaimEntity, {
            where: { status: "open", claimedAt: LessThanOrEqual(before) },
            order: { claimedAt: "ASC" },
            take: limit,
        })
        return claims.map(toRow)
    }

    /** Hands an open claim to a person; false when it was no longer open, so a claim is escalated once. */
    async escalate(workspaceId: string, claimId: string): Promise<boolean> {
        const moved = await this.entityManager.update(
            PaymentClaimEntity,
            { workspaceId, id: claimId, status: "open" },
            { status: "escalated" },
        )
        return (moved.affected ?? 0) > 0
    }
}
