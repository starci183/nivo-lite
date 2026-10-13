import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { toDataSyncRun } from "./data-sync-runs.mapper"
import type { DataSyncRunState, DataSyncTrigger, FoundRun } from "./data-sync-runs.contracts"
import type { DataSyncRunRow } from "./persistence/data-sync-runs.rows"
import { FIND_SYNC_RUN, FINISH_SYNC_RUN, INSERT_SYNC_RUN } from "./persistence/data-sync-runs.sql"

@Injectable()
/** The record of every sync: a run opens as running and ends once as ok or failed; the only writer of public.data_sync_runs. */
export class DataSyncRunsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Opens a run as running inside the caller's transaction and answers it. */
    async open(tx: EntityManager, workspaceId: string, connectionId: string, trigger: DataSyncTrigger): Promise<FoundRun> {
        const [row] = await tx.query<Array<DataSyncRunRow>>(INSERT_SYNC_RUN, [workspaceId, connectionId, trigger])
        return row === undefined ? null : toDataSyncRun(row)
    }

    /** Settles a run that is still running; a run already settled is left as it is. */
    async finish(runId: string, state: Exclude<DataSyncRunState, "running">, rows: number, error: string | null): Promise<void> {
        await this.entityManager.query(FINISH_SYNC_RUN, [runId, state, rows, error])
    }

    /** One run of the workspace, or null when there is none. */
    async find(workspaceId: string, runId: string): Promise<FoundRun> {
        const [row] = await this.entityManager.query<Array<DataSyncRunRow>>(FIND_SYNC_RUN, [workspaceId, runId])
        return row === undefined ? null : toDataSyncRun(row)
    }
}
