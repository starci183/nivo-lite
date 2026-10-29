import { isRecord } from "@modules/platform/primitives"
import type { ThreadStatus, WorkThread, WorkThreadRecord } from "./work-threads.contracts"

const STATUSES: ReadonlyArray<ThreadStatus> = ["open", "waiting", "done", "stopped"]

const statusOf = (value: string): ThreadStatus => STATUSES.find((status) => status === value) ?? "open"

/** One thread row as the API reads it: the stored status narrowed to the vocabulary, instants as ISO 8601. */
export const toThread = (row: WorkThreadRecord): WorkThread => ({
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

const isThreadRecord = (value: unknown): value is WorkThreadRecord =>
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.workspace_id === "string" &&
    typeof value.title === "string" &&
    typeof value.status === "string"

/** The first thread row a RETURNING write answered; undefined when it answered none. */
export const firstThreadRecord = (raw: unknown): WorkThreadRecord | undefined =>
    Array.isArray(raw) ? raw.find(isThreadRecord) : undefined
