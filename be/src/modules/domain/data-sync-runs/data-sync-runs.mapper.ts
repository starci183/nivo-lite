import type { DataSyncRun, DataSyncRunState, DataSyncTrigger } from "./data-sync-runs.contracts"
import type { DataSyncRunEntity } from "./persistence/entities"

const TRIGGERS: ReadonlyArray<DataSyncTrigger> = ["schedule", "manual", "upload", "push"]

/** The trigger a stored run names; a value the table never holds reads as manual. */
const triggerOf = (value: string): DataSyncTrigger => TRIGGERS.find((trigger) => trigger === value) ?? "manual"

/** The state a stored run names; anything but ok and failed is still running. */
const stateOf = (value: string): DataSyncRunState => (value === "ok" || value === "failed" ? value : "running")

/** A stored sync run as the capability answers it. */
export const toDataSyncRun = (row: DataSyncRunEntity): DataSyncRun => ({
    id: row.id,
    connectionId: row.connectionId,
    trigger: triggerOf(row.trigger),
    state: stateOf(row.status),
    rows: row.rowsUpserted,
    error: row.error,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
})
