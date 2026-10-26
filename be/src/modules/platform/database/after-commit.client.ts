import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { AfterCommit, CommitTask } from "./after-commit.port"

@Injectable()
/**
 * Runs work after the transaction of a writer committed. A push that went out before the commit would let a client refetch
 * stale data, and a push for a rolled-back change would announce something that never happened, so the work of a transaction
 * that is still open is held until its commit and dropped on its rollback. Outside a transaction it runs at once. The database
 * module subscribes `commit` and `rollback` to the connection's transaction events.
 */
export class AfterCommitClient implements AfterCommit {
    private readonly pending = new Map<EntityManager, Array<CommitTask>>()

    /** Runs the task when the manager's transaction commits (now when the manager is not inside one). */
    async run(manager: EntityManager, task: CommitTask): Promise<void> {
        if (!manager.queryRunner?.isTransactionActive) {
            await task()
            return
        }
        this.pending.set(manager, [...(this.pending.get(manager) ?? []), task])
    }

    /** The transaction of the manager committed: runs what it held, once. */
    async commit(manager: EntityManager): Promise<void> {
        const tasks = this.pending.get(manager) ?? []
        this.pending.delete(manager)
        await Promise.all(tasks.map((task) => task()))
    }

    /** The transaction of the manager rolled back: what it held never happened. */
    rollback(manager: EntityManager): void {
        this.pending.delete(manager)
    }
}
