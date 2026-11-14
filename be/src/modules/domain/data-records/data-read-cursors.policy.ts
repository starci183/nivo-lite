import type { HubReader } from "./data-records.contracts"

/** The key of a reader's `imap.read-cursor` row on a mailbox: `<agent id>:<entity>` (the declared key fields, joined). */
export const cursorKeyOf = (reader: HubReader): string => `${reader.agentId}:${reader.entity}`

/** The saved point of a cursor row's value, or null when it holds none. */
export const seenThroughOf = (value: Readonly<Record<string, unknown>>): string | null =>
    typeof value.seenThrough === "string" && value.seenThrough !== "" ? value.seenThrough : null

/**
 * True when `next` moves past the saved point (by code unit, as the store compares a text position: the point's instant is written
 * fixed-width, so code-unit order is time order); any point moves a cursor that holds none.
 */
export const isForward = (saved: string | null, next: string): boolean => saved === null || next > saved
