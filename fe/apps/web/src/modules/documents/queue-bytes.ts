import type { QueueItem } from "./queue"
import { BYTES_PER_MB } from "./usage"

/** The app formatter, narrowed to the one call the byte counts make. */
interface BytesFormatter {
    readonly number: (value: number, options: { maximumFractionDigits: number }) => string
}

/** The words the byte counts of an upload are said with. */
type BytesSay = (
    key: "uploadStoppedAt" | "uploadBytes" | "batchBytesLabel" | "batchBytes",
    values?: Record<string, string | number>,
) => string

/** Megabytes with one decimal in the reader's language, through the app formatter. */
const megabytesOf = (formatter: BytesFormatter, bytes: number): string =>
    formatter.number(bytes / BYTES_PER_MB, { maximumFractionDigits: 1 })

/** The bytes of a file that reached storage: the whole size once it is queued, the fraction while it travels, 0 before. */
const sentBytesOf = (item: QueueItem): number => {
    const size = item.size ?? 0
    return item.status === "queued" ? size : Math.round(size * (item.uploaded ?? 0))
}

/** What a file row says about its bytes: how far it got while it travels, or where it stopped; empty for a link or a file not sent yet. */
export const bytesDetailOf = (say: BytesSay, formatter: BytesFormatter, item: QueueItem): string => {
    const size = item.size ?? 0
    if (item.file === undefined || size === 0 || item.uploaded === undefined) return ""
    const sent = megabytesOf(formatter, sentBytesOf(item))
    const all = megabytesOf(formatter, size)
    const percent = Math.round((sentBytesOf(item) / size) * 100)
    return say(item.status === "failed" ? "uploadStoppedAt" : "uploadBytes", { sent, size: all, percent })
}

/** The bytes of the whole batch while it travels, or undefined when no file is on its way. */
export const batchBytesOf = (say: BytesSay, formatter: BytesFormatter, items: ReadonlyArray<QueueItem>) => {
    const files = items.filter((item) => item.file !== undefined && (item.size ?? 0) > 0)
    if (!files.some((item) => item.status === "uploading")) return undefined
    const total = files.reduce((sum, item) => sum + (item.size ?? 0), 0)
    const sent = files.reduce((sum, item) => sum + sentBytesOf(item), 0)
    const percent = Math.round((sent / total) * 100)
    return {
        label: say("batchBytesLabel"),
        value: percent,
        valueText: say("batchBytes", {
            count: files.length,
            sent: megabytesOf(formatter, sent),
            total: megabytesOf(formatter, total),
            percent,
        }),
    }
}
