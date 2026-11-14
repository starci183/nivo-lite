import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import type { AccountExpiry, AccountSweepFence } from "./account-data.contracts"
import { MAX_SWEEP_BATCHES, expiriesOf, sweepBatchOf } from "./account-data.policy"
import { AccountDataTypesService } from "./account-data-types.service"
import { AccountDataEntity } from "./persistence/entities"

@Injectable()
/**
 * Keeps every declared type of `account_data` within its own retention: rows older than the type's days (a `wakes` type: completed
 * rows only, a pending row is never deleted) and rows older than its ttl are deleted batch by batch on the database clock, oldest
 * first, until a batch comes back short or the type has spent its batch budget (the next pass continues). A type kept for good is
 * never touched. Deleting an expired row twice changes nothing; the fenced job that runs the pass is asked before every batch.
 */
export class AccountDataRetentionService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly types: AccountDataTypesService,
    ) {}

    /** Sweeps every declared type with the batch size the payload carries (`{ batch }`, default 1000) and answers how many rows it deleted. */
    async sweep(payload: unknown, beforeBatch: AccountSweepFence): Promise<number> {
        const batch = sweepBatchOf(payload)
        const counts: Array<number> = []
        await eachInOrder(
            this.types.all().flatMap((def) => expiriesOf(def)),
            async (expiry) => {
                counts.push(await this.sweepExpiry(expiry, batch, beforeBatch, MAX_SWEEP_BATCHES))
            },
        )
        return counts.reduce((total, count) => total + count, 0)
    }

    /** Runs one batch under the fence, then the next while batches come back full and the type has batches left. */
    private async sweepExpiry(
        expiry: AccountExpiry,
        batch: number,
        beforeBatch: AccountSweepFence,
        batchesLeft: number,
    ): Promise<number> {
        if (batchesLeft === 0) return 0
        await beforeBatch()
        // One bounded batch of one partition, aged on the database clock, oldest first.
        const result = await this.entityManager
            .createQueryBuilder(AccountDataEntity, "r")
            .delete()
            .where(
                "(type, id) IN (SELECT old.type, old.id FROM public.account_data old " +
                    "WHERE old.type = :type AND old.occurred_at < now() - make_interval(secs => CAST(:seconds AS double precision)) " +
                    (expiry.processedOnly ? "AND old.processed_at IS NOT NULL " : "") +
                    "ORDER BY old.occurred_at LIMIT :batch)",
                { type: expiry.type, seconds: expiry.seconds, batch },
            )
            .execute()
        const deleted = result.affected ?? 0
        return deleted < batch
            ? deleted
            : deleted + (await this.sweepExpiry(expiry, batch, beforeBatch, batchesLeft - 1))
    }
}
