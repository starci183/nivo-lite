import { contactBlockNodeOf, type ModuleContactBlock } from "@nivo-lite/agent-sdk/module"
import type { Locale } from "@modules/platform/i18n"
import type { ContactModuleBlockView } from "./contact-blocks.contracts"
import { CONTACT_BLOCK_PAGE, type ContactBlockPage } from "./contact-blocks.schema"

/** The most rows a block shows on the contact detail: the first rows only, the rest is the module's own workbench. */
export const CONTACT_BLOCK_ROWS_MAX = 5

/** The answer of a read as the page draws it: the first rows, and whether the contact has more. */
interface BoundedRows {
    readonly rows: ReadonlyArray<unknown>
    readonly hasMore: boolean
}

/** What reading a read's JSON answer as a page gave: the page, or what went wrong (the cause travels, nothing is hidden). */
type PageRead = { readonly ok: true; readonly page: ContactBlockPage } | { readonly ok: false; readonly cause: unknown }

/** The JSON text a list read answered, read as its page; a text that is no JSON, or no page of rows, is a refusal carrying the cause. */
const contactBlockPageOf = (text: string): PageRead => {
    try {
        const parsed = CONTACT_BLOCK_PAGE.safeParse(JSON.parse(text))
        return parsed.success ? { ok: true, page: parsed.data } : { ok: false, cause: parsed.error }
    } catch (cause) {
        return { ok: false, cause }
    }
}

/** The rows of a list read's answer, cut to the bound; none for an answer that is no page. */
const boundedRowsOf = (data: string): BoundedRows => {
    const read = contactBlockPageOf(data)
    if (!read.ok) return { rows: [], hasMore: false }
    return {
        rows: read.page.rows.slice(0, CONTACT_BLOCK_ROWS_MAX),
        hasMore: typeof read.page.cursor === "string" || read.page.rows.length > CONTACT_BLOCK_ROWS_MAX,
    }
}

/**
 * One block as the contact detail draws it: its title in the viewer's language, the spec node for this contact, and the read's first rows
 * (no cursor: the page loads no more, the module's own workbench holds the rest).
 */
export const contactBlockViewOf = (
    block: ModuleContactBlock,
    contactId: string,
    locale: Locale,
    data: string,
): ContactModuleBlockView => {
    const bounded = boundedRowsOf(data)
    return {
        id: block.id,
        title: block.title[locale],
        nodeJson: JSON.stringify(contactBlockNodeOf(block, contactId)),
        dataJson: JSON.stringify({ rows: bounded.rows, cursor: null }),
        count: bounded.rows.length,
        hasMore: bounded.hasMore,
    }
}
