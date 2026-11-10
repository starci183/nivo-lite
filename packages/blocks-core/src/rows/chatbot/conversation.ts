import { textOf, valueAt } from "../../slots/paths"
import type {
    DayName,
    DeliveryState,
    MessageFile,
    MessageFiles,
    MessageOrder,
    MessageOrderItem,
    MessageOrderMember,
    MessagePaths,
    MessageRow,
    MessageSide,
    ThreadEntry,
} from "./conversation.types"

/** Messages of one author within this gap, on one day, form one group. */
export const GROUP_GAP_MS: number = 5 * 60_000

const SIDES: ReadonlyArray<MessageSide> = ["incoming", "outgoing", "notice"]
const DAY_MS = 86_400_000

/** The transport states a bound text names the delivery of a message by. */
const DELIVERY_BY_TEXT: Readonly<Record<string, DeliveryState>> = {
    queued: "queued",
    sending: "queued",
    pending: "queued",
    sent: "sent",
    delivered: "sent",
    read: "sent",
    seen: "sent",
    failed: "failed",
    error: "failed",
}

/** The delivery state a bound text names; a text that names none of them is unknown, and no text draws no mark. */
export const deliveryOf = (text: string): DeliveryState | null => {
    if (text === "") return null
    return DELIVERY_BY_TEXT[text.trim().toLowerCase()] ?? "unknown"
}

/** The side a bound text names; anything else is an incoming message. */
export const sideOf = (text: string): MessageSide => SIDES.find((side) => side === text) ?? "incoming"

/** The text at an optional path of a record; nothing without a path. */
const textAt = (record: unknown, path: string | undefined): string =>
    path === undefined ? "" : textOf(valueAt(record, path))

/** The milliseconds of an ISO text; null when it is no time. */
const msOf = (text: string): number | null => {
    const ms = Date.parse(text)
    return Number.isNaN(ms) ? null : ms
}

/** The pictures and files of a record at an optional path; entries that are not files are left out. */
const filesAt = (record: unknown, path: string | undefined): ReadonlyArray<MessageFile> => {
    const list = path === undefined ? null : valueAt(record, path)
    if (!Array.isArray(list)) return []
    return list.flatMap((entry: unknown): ReadonlyArray<MessageFile> => {
        const url = textOf(valueAt(entry, "url"))
        if (url === "") return []
        return [
            {
                id: textOf(valueAt(entry, "id")) || url,
                url,
                name: textOf(valueAt(entry, "name")),
                contentType: textOf(valueAt(entry, "contentType")),
            },
        ]
    })
}

/** The `files` member of a message: present only when the record carries some. */
const filesOf = (record: unknown, path: string | undefined): MessageFiles => {
    const files = filesAt(record, path)
    return files.length === 0 ? {} : { files }
}

/** The order of a record at an optional path; nothing when the value is not an order with a number. */
const orderAt = (record: unknown, path: string | undefined): MessageOrder | null => {
    const value = path === undefined ? null : valueAt(record, path)
    const orderNo = textOf(valueAt(value, "orderNo"))
    if (value === null || value === undefined || orderNo === "") return null
    const list = valueAt(value, "lines")
    const lines = Array.isArray(list)
        ? list.flatMap((entry: unknown): ReadonlyArray<MessageOrderItem> => {
              const name = textOf(valueAt(entry, "name"))
              if (name === "") return []
              const qty = Number(valueAt(entry, "qty"))
              return [
                  {
                      name,
                      qty: Number.isFinite(qty) ? qty : 1,
                      unitText: textOf(valueAt(entry, "unitText")),
                      amountText: textOf(valueAt(entry, "amountText")),
                      imageUrl: textOf(valueAt(entry, "imageUrl")),
                  },
              ]
          })
        : []
    return {
        orderNo,
        lines,
        amountText: textOf(valueAt(value, "amountText")),
        address: textOf(valueAt(value, "address")),
        paid: valueAt(value, "paid") === true,
    }
}

/** The `order` member of a message: present only when the record is about an order. */
const orderOf = (record: unknown, path: string | undefined): MessageOrderMember => {
    const order = orderAt(record, path)
    return order === null ? {} : { order }
}

/** The message of one record; a record without a text id draws none. */
const messageOf = (record: unknown, paths: MessagePaths): ReadonlyArray<MessageRow> => {
    const id = textOf(valueAt(record, paths.idPath))
    if (id === "") return []
    const side = sideOf(textAt(record, paths.sidePath))
    return [
        {
            id,
            author: textAt(record, paths.authorPath),
            text: textOf(valueAt(record, paths.textPath)),
            side,
            atMs: msOf(textAt(record, paths.timePath)),
            mark: textAt(record, paths.markPath),
            delivery: side === "outgoing" ? deliveryOf(textAt(record, paths.statusPath)) : null,
            ...filesOf(record, paths.filesPath),
            ...orderOf(record, paths.orderPath),
        },
    ]
}

/** Puts the messages in the order they were written; with a message that has no time they stay in the order they arrived. */
const inOrder = (rows: ReadonlyArray<MessageRow>): ReadonlyArray<MessageRow> => {
    const timed = rows.flatMap((row) => (row.atMs === null ? [] : [{ atMs: row.atMs, row }]))
    if (timed.length !== rows.length) return rows
    return timed.toSorted((left, right) => left.atMs - right.atMs).map((entry) => entry.row)
}

/** The messages of a bound list, oldest first, or null when none can be drawn, which the block reads as an empty slot. */
export const messagesOf = (records: ReadonlyArray<unknown>, paths: MessagePaths): ReadonlyArray<MessageRow> | null => {
    const rows = records.flatMap((record) => messageOf(record, paths))
    return rows.length === 0 ? null : inOrder(rows)
}

/** The calendar day of a moment in the zone of the viewer, as `YYYY-MM-DD`. */
export const dayKeyOf = (atMs: number, zone: string | undefined): string =>
    new Intl.DateTimeFormat("en-CA", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(atMs)

/** Whether a message continues the group of the one before it. */
const continues = (previous: MessageRow | null, row: MessageRow, isNewDay: boolean): boolean => {
    if (previous === null || isNewDay) return false
    if (row.side === "notice" || previous.side === "notice") return false
    if (previous.side !== row.side || previous.author !== row.author) return false
    if (previous.atMs === null || row.atMs === null) return true
    return row.atMs - previous.atMs <= GROUP_GAP_MS
}

/** The day dividers and the messages between them, in order, with the grouping of authors decided. */
export const entriesOf = (rows: ReadonlyArray<MessageRow>, zone: string | undefined): ReadonlyArray<ThreadEntry> => {
    const entries: Array<ThreadEntry> = []
    let previous: MessageRow | null = null
    let day = ""
    for (const row of rows) {
        const key = row.atMs === null ? day : dayKeyOf(row.atMs, zone)
        const isNewDay = row.atMs !== null && key !== day
        if (isNewDay) {
            entries.push({ kind: "day", id: `day-${key}`, atMs: row.atMs })
            day = key
        }
        entries.push({ kind: "message", id: row.id, row, isContinuation: continues(previous, row, isNewDay) })
        previous = row
    }
    return entries
}

/** The name of the day of a moment, against now: today and yesterday by word, any other day by its date. */
export const dayNameOf = (atMs: number, nowMs: number, locale: string, zone: string | undefined): DayName => {
    const key = dayKeyOf(atMs, zone)
    const formatted = new Intl.DateTimeFormat(locale, { timeZone: zone, dateStyle: "long" }).format(atMs)
    if (key === dayKeyOf(nowMs, zone)) return { relative: "today", formatted }
    if (key === dayKeyOf(nowMs - DAY_MS, zone)) return { relative: "yesterday", formatted }
    return { relative: null, formatted }
}

/** The time of day of a moment in the language and zone of the viewer; empty for a message without a time. */
export const timeLabelOf = (atMs: number | null, locale: string, zone: string | undefined): string =>
    atMs === null
        ? ""
        : new Intl.DateTimeFormat(locale, { timeZone: zone, hour: "2-digit", minute: "2-digit", hour12: false }).format(
              atMs,
          )
