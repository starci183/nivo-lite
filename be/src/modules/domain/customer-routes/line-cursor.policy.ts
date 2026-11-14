import type { LineCursor } from "./customer-line-store.port"

/** A cursor of a thread: the said-at instant in milliseconds, a dot, the insertion number. */
const CURSOR = /^(\d{1,15})\.(\d{1,18})$/u

/** The position a cursor text names (strictly older lines follow it), or null for none or a malformed one: the thread starts at the newest. */
export const cursorOf = (value: string | null | undefined): LineCursor | null => {
    const match = value === null || value === undefined ? null : CURSOR.exec(value)
    if (match === null) return null
    const [, ms, seq] = match
    return ms === undefined || seq === undefined ? null : { saidAt: new Date(Number(ms)), seq }
}

/** The text of the cursor a page hands out for the page after it. */
export const cursorTextOf = (cursor: LineCursor): string => `${String(cursor.saidAt.getTime())}.${cursor.seq}`
