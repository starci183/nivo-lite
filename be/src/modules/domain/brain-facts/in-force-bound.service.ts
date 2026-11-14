import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { advisoryXactLock } from "@modules/platform/database"
import { BrainFactsReadService } from "./brain-facts-read.service"
import { BrainFactsError, BrainFactsErrorCode } from "./errors/brain-facts.error"
import { addsOverBound, inForceLockKey, type InForceBound } from "./in-force.policy"

/**
 * A bound that also GUARDS its write: `guard` runs under the workspace's in-force lock, before the write, and throws to refuse it
 * (nothing is written, the caller's transaction rolls back). The automatic path of a document's truths passes one: two documents
 * settled in parallel with rival values for one key each saw "nothing argues" before the lock; the second to take the lock sees the
 * first one's value in force and is refused (owner 2026-11-12, the race of direct apply).
 */
export interface GuardedBound extends InForceBound {
    /** Runs under the lock before the write; throws to refuse it. */
    readonly guard: () => Promise<void>
}

/** Whether a bound carries a guard. */
const isGuarded = (bound: InForceBound): bound is GuardedBound => "guard" in bound

@Injectable()
/**
 * The BOUNDED write of the truths in force (D-U-1: the ceiling under parallel settles): the check and the write are ONE step the
 * database decides. Inside the caller's transaction it takes the workspace's in-force lock first, so bounded writes of one workspace
 * run one after the other however many jobs settle at once; it runs the bound's guard when it has one (`GuardedBound`), counts what is
 * in force, lets the write run, counts again, and when the write added to what is in force and took it above the bound it throws
 * `InForceFull`: the caller's transaction rolls back, the truth still waits, nothing was written. A write with no bound (the founder's
 * own decision) runs as it is: no lock, no count.
 */
export class InForceBoundService {
    constructor(private readonly reads: BrainFactsReadService) {}

    /** Runs `write` in the transaction `tx`, under `bound` when one is given. */
    async within<T>(tx: EntityManager, workspaceId: string, bound: InForceBound | undefined, write: () => Promise<T>): Promise<T> {
        if (bound === undefined) return write()
        await advisoryXactLock(tx, inForceLockKey(workspaceId))
        if (isGuarded(bound)) await bound.guard()
        const before = await this.reads.heldInForce(tx, workspaceId)
        const written = await write()
        if (addsOverBound(before, await this.reads.heldInForce(tx, workspaceId), bound))
            throw new BrainFactsError({ code: BrainFactsErrorCode.InForceFull })
        return written
    }
}
