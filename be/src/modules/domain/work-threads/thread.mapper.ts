import type { ThreadStatus, WorkThread } from "./work-threads.contracts"
import type { ThreadRow } from "./persistence/work-threads.rows"

const STATUSES: ReadonlyArray<ThreadStatus> = ["open", "waiting", "done", "stopped"]

const statusOf = (value: string): ThreadStatus => STATUSES.find((status) => status === value) ?? "open"

/** One thread row as the API reads it: the stored status narrowed to the vocabulary, instants as ISO 8601. */
export const toThread = (row: ThreadRow): WorkThread => ({
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    leadId: row.lead_id,
    orderId: row.order_id,
    status: statusOf(row.status),
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
})
