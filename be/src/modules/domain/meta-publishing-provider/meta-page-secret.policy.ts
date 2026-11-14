import { isRecord, parseJsonText } from "@modules/platform/primitives"

/** The chosen Page of a Meta account, as its sealed credential holds it; each member absent until a Page is chosen. */
export interface MetaPageSecret {
    /** The chosen Page. */
    readonly pageId?: string | undefined
    /** The chosen Page token. */
    readonly pageToken?: string | undefined
}

/** A text member of an object, or undefined. */
const textOf = (value: Readonly<Record<string, unknown>>, key: string): string | undefined => {
    const member = value[key]
    return typeof member === "string" ? member : undefined
}

/**
 * The chosen Page of the provider's own sealed credential (`{ pageId, pageToken, pages }`, the shape the Meta connection keeps once a Page
 * is chosen): the two members the publishing provider sends with. An empty or unreadable secret chose no Page.
 */
export const metaPageSecretOf = (plain: string): MetaPageSecret => {
    const read = parseJsonText(plain)
    if (!read.ok || !isRecord(read.value) || Array.isArray(read.value)) return {}
    const pageId = textOf(read.value, "pageId")
    const pageToken = textOf(read.value, "pageToken")
    return { ...(pageId === undefined ? {} : { pageId }), ...(pageToken === undefined ? {} : { pageToken }) }
}
