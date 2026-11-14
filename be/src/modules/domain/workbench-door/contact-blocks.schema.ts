import { z } from "zod"

/** The most rows of a read's answer this schema looks at (a read's own page is far smaller). */
const ROWS_READ_MAX = 1000

/** A list read's answer: its rows and the cursor of the next page. */
export interface ContactBlockPage {
    /** The rows of the page. */
    readonly rows: ReadonlyArray<Record<string, unknown>>
    /** The cursor of the next page; absent or null when there is none. */
    readonly cursor?: string | null | undefined
}

/** A list read's answer: its rows and the cursor of the next page. */
export const CONTACT_BLOCK_PAGE: z.ZodType<ContactBlockPage> = z.object({
    rows: z.array(z.looseObject({})).max(ROWS_READ_MAX),
    cursor: z.string().max(512).nullish(),
})
