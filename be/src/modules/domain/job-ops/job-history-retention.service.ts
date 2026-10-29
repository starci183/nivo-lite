import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { MAX_SWEEP_BATCHES, retentionWindowOf } from "./job-history-retention.policy"
import type { HistoryRetentionWindow, SweepFence } from "./job-history-retention.policy"
import type { HistorySweepRow } from "./persistence/job-ops.rows"

@Injectable()
/**
 * Keeps the system history bounded: each pass calls the database sweep function batch by batch until every table comes back short or the
 * pass has spent its batch budget. The function deletes only finished rows older than their window, so a repeated or concurrent pass is
 * harmless; the fenced job that runs it is asked before every batch.
 */
export class JobHistoryRetentionService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Sweeps with the window the payload carries (defaults otherwise) and answers how many rows it deleted. */
    sweep(payload: unknown, beforeBatch: SweepFence): Promise<number> {
        return this.sweepFrom(retentionWindowOf(payload), beforeBatch, MAX_SWEEP_BATCHES)
    }

    private async sweepFrom(
        window: HistoryRetentionWindow,
        beforeBatch: SweepFence,
        batchesLeft: number,
    ): Promise<number> {
        if (batchesLeft === 0) return 0
        await beforeBatch()
        const [row] = await callDbFunction<HistorySweepRow>(this.entityManager, "public.system_history_sweep", [
            window.doneDays,
            window.failedDays,
            window.batch,
        ])
        const counts = row?.system_history_sweep
        if (counts === undefined) return 0
        const deleted = counts.outbox + counts.jobs + counts.cron + counts.http
        const full = Math.max(counts.outbox, counts.jobs, counts.cron, counts.http) >= window.batch
        return full ? deleted + (await this.sweepFrom(window, beforeBatch, batchesLeft - 1)) : deleted
    }
}
