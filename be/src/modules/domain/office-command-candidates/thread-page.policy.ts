import type { MessageCursor, MessagePage, MessageView, OptionalMessageCursor } from "./office.contracts"

/** The biggest page of the thread one call returns. */
export const THREAD_PAGE_MAX = 100

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A requested page size forced into 1..100; a non-integer rounds down and a non-number becomes 1. */
export const clampPageSize = (requested: number): number =>
    Number.isFinite(requested) ? Math.min(THREAD_PAGE_MAX, Math.max(1, Math.floor(requested))) : 1

/** Whether a cursor can be handed to the keyset query: a parseable timestamp and a UUID. */
export const isValidCursor = (cursor: MessageCursor): boolean =>
    !Number.isNaN(Date.parse(cursor.createdAt)) && UUID_PATTERN.test(cursor.id)

/** Splits the `size + 1` rows a keyset query returned into the page and the cursor of the next, older one. */
export const splitPage = (fetched: ReadonlyArray<MessageView>, size: number): MessagePage => {
    const messages = fetched.slice(0, size)
    const last = messages.at(-1)
    const next: OptionalMessageCursor =
        fetched.length > size && last !== undefined ? { createdAt: last.created_at, id: last.id } : null
    return { messages, next }
}
