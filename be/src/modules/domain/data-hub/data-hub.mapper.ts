import type { ConnectionRecord, SyncSchedule } from "@modules/domain/connections"
import type { DataConnection, DataProvider } from "./data-hub.contracts"

/** A connection record, its data provider (the caller checked it) and its schedule as a data connection. */
export const toDataConnection = (
    record: ConnectionRecord,
    provider: DataProvider,
    schedule: SyncSchedule,
): DataConnection => ({
    id: record.id,
    workspaceId: record.workspaceId,
    provider,
    name: record.name,
    status: record.status,
    lastError: record.lastError,
    meta: record.meta,
    everyMinutes: schedule.everyMinutes,
    lastSyncAt: schedule.lastSyncAt,
})
