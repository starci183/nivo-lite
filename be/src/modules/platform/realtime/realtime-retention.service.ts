import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { writerOf } from "./realtime-connection.policy"
import { REPLAY_TTL_MS, SWEEP_BATCH, SWEEP_MAX_BATCHES } from "./realtime.contracts"
import { InjectRealtimeManagers } from "./realtime.decorators"
import type { RealtimeRetention, SweepFence } from "./realtime-retention.port"
import { DELETE_EXPIRED_EVENTS } from "./persistence/realtime.sql"
import type { DeletedCountRow } from "./persistence/realtime.rows"

@Injectable()
/**
 * Keeps the `realtime_events` replay table bounded: one pass deletes the frames older than the replay window, batch by batch, until a
 * batch comes back short or the pass has run its batch budget (the next pass continues). Every batch is one statement on the database clock, and deleting
 * an expired row twice changes nothing, so a repeated or concurrent pass is harmless; the fenced job that runs it decides who runs and
 * when, and is asked before every batch (a worker that lost the fence between the ask and the batch deletes at most one idempotent batch).
 */
export class RealtimeRetentionService implements RealtimeRetention {
    constructor(@InjectRealtimeManagers() private readonly managers: ReadonlyArray<EntityManager>) {}

    /** Deletes expired frames in bounded batches and answers how many it deleted. */
    sweep(beforeBatch: SweepFence): Promise<number> {
        return this.sweepFrom(beforeBatch, SWEEP_MAX_BATCHES)
    }

    /** Runs one batch under the fence, then the next while batches come back full and the pass has batches left. */
    private async sweepFrom(beforeBatch: SweepFence, batchesLeft: number): Promise<number> {
        if (batchesLeft === 0) return 0
        await beforeBatch()
        const [row] = await writerOf(this.managers).query<Array<DeletedCountRow>>(DELETE_EXPIRED_EVENTS, [
            REPLAY_TTL_MS,
            SWEEP_BATCH,
        ])
        const deleted = Number(row?.deleted ?? 0)
        return deleted < SWEEP_BATCH ? deleted : deleted + (await this.sweepFrom(beforeBatch, batchesLeft - 1))
    }
}
