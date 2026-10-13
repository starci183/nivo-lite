import type { ConnectionRecord, SyncSchedule } from "@modules/domain/connections"
import type { DataConnection, DataProvider, DataSyncRun, DataSyncRunState, DataSyncTrigger } from "./data-hub.contracts"
import type { DataSyncRunRow } from "./persistence/data-hub.rows"

/** A connection record and its schedule as a data connection; the caller has checked the provider. */
export const toDataConnection = (record: ConnectionRecord, schedule: SyncSchedule): DataConnection => ({
    id: record.id,
    workspaceId: record.workspaceId,
    provider: record.provider as DataProvider,
    name: record.name,
    status: record.status,
    lastError: record.lastError,
    meta: record.meta,
    everyMinutes: schedule.everyMinutes,
    lastSyncAt: schedule.lastSyncAt,
})

/** A stored sync run as the capability answers it. */
export const toDataSyncRun = (row: DataSyncRunRow): DataSyncRun => ({
    id: row.id,
    connectionId: row.connection_id,
    trigger: row.trigger as DataSyncTrigger,
    state: row.status as DataSyncRunState,
    rows: row.rows_upserted,
    error: row.error,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
})
