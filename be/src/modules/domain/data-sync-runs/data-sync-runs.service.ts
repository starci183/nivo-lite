import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { toDataSyncRun } from "./data-sync-runs.mapper"
import type { DataSyncTrigger, FoundRun, RunFailure, SettledRunState } from "./data-sync-runs.contracts"
import { DataSyncRunEntity } from "./persistence/entities"

/** The columns an opened run answers, named as the entity properties so the answer reads as an entity. */
const RETURNED = [
    "id",
    'workspace_id AS "workspaceId"',
    'connection_id AS "connectionId"',
    "trigger",
    "status",
    'rows_upserted AS "rowsUpserted"',
    "error",
    'started_at AS "startedAt"',
    'finished_at AS "finishedAt"',
].join(", ")

/** True when a RETURNING row names the key of a stored run, the shape the returned columns give it. */
const isDataSyncRunEntity = (value: unknown): value is DataSyncRunEntity =>
    typeof value === "object" && value !== null && "id" in value && typeof value.id === "string"

/** The rows a write answered. */
const returnedRuns = (raw: unknown): Array<DataSyncRunEntity> =>
    Array.isArray(raw) ? raw.filter(isDataSyncRunEntity) : []

@Injectable()
/** The record of every sync: a run opens as running and ends once as ok or failed; the only writer of public.data_sync_runs. */
export class DataSyncRunsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Opens a run as running inside the caller's transaction and answers it. */
    async open(
        tx: EntityManager,
        workspaceId: string,
        connectionId: string,
        trigger: DataSyncTrigger,
    ): Promise<FoundRun> {
        const opened = await tx
            .createQueryBuilder(DataSyncRunEntity, "dsr")
            .insert()
            .values({ workspaceId, connectionId, trigger })
            .returning(RETURNED)
            .execute()
        const [row] = returnedRuns(opened.raw)
        return row === undefined ? null : toDataSyncRun(row)
    }

    /** Settles a run that is still running; a run already settled is left as it is. */
    async finish(runId: string, state: SettledRunState, rows: number, error: RunFailure): Promise<void> {
        await this.entityManager.update(
            DataSyncRunEntity,
            { id: runId, status: "running" },
            { status: state, rowsUpserted: rows, error, finishedAt: () => "now()" },
        )
    }

    /** One run of the workspace, or null when there is none. */
    async find(workspaceId: string, runId: string): Promise<FoundRun> {
        const row = await this.entityManager.findOne(DataSyncRunEntity, { where: { workspaceId, id: runId } })
        return row === null ? null : toDataSyncRun(row)
    }
}
