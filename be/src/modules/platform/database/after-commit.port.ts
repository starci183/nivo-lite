import type { EntityManager } from "typeorm"

/** Work that waits for the commit of one transaction. */
export type CommitTask = () => Promise<void>

/** The after-commit capability: work that must be seen only once the writer's transaction is durable. */
export interface AfterCommit {
    /** Runs the task when the manager's transaction commits, drops it on rollback, and runs it at once outside a transaction. */
    run(manager: EntityManager, task: CommitTask): Promise<void>
}
