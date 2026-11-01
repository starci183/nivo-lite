import { bytesDetailOf } from "./queue-bytes"
import { canRetry } from "./queue"
import type { QueueItem } from "./queue"

/** The words a queue row is said with. */
type RowSay = (key: string, values?: Record<string, string | number>) => string

/** The app formatter, narrowed to the one call the byte counts make. */
interface RowFormatter {
    readonly number: (value: number, options: { maximumFractionDigits: number }) => string
}

/** Badge tones used by the document upload queue. */
type QueueStatusTone = "success" | "danger" | "warning" | "neutral"

/** Feedback tone for each queued document status. */
const STATUS_TONE: Readonly<Record<QueueItem["status"], QueueStatusTone>> = {
    waiting: "neutral",
    uploading: "warning",
    queued: "success",
    failed: "danger",
}

/** Translation keys for queued document statuses. */
const QUEUE_STATUS_KEYS: Readonly<Record<QueueItem["status"], string>> = {
    waiting: "itemWaiting",
    uploading: "itemUploading",
    queued: "itemQueued",
    failed: "itemFailed",
}

/** The status badge of a row: a file whose bytes all arrived is being put in the queue. */
const statusLabelOf = (say: RowSay, item: QueueItem): string =>
    item.status === "uploading" && item.uploaded === 1 ? say("itemEnqueuing") : say(QUEUE_STATUS_KEYS[item.status])

/** The row of the queue for one file or link, already worded; `isBusy` is true while the queue is being sent. */
export const queueRowOf = (say: RowSay, formatter: RowFormatter, isBusy: boolean, item: QueueItem) => ({
    id: item.id,
    name: item.name,
    detail: [
        say(item.kind === "link" ? "itemLink" : "itemFile"),
        item.origin ?? "",
        bytesDetailOf(say, formatter, item),
    ]
        .filter(Boolean)
        .join(" · "),
    statusLabel: statusLabelOf(say, item),
    statusTone: STATUS_TONE[item.status],
    error: item.error === undefined ? undefined : say(item.error),
    canRemove: item.status !== "uploading" && !isBusy,
    retryLabel: item.status === "failed" && canRetry(item) && !isBusy ? say("itemRetry") : undefined,
})
