import { LocalStorage } from "./storage"
import { StorageId } from "./ids"

/** The ids of the sites whose form this page has served, kept for the page's lifetime when the browser refuses storage. */
const held = new Map<string, string>()

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The ids this browser keeps per site key; anything that is not a record of ids reads as empty. */
const keptIds = (): Readonly<Record<string, string>> => {
    const stored = LocalStorage.get<unknown>(StorageId.WebsiteVisitors)
    if (typeof stored !== "object" || stored === null) return {}
    return Object.fromEntries(
        Object.entries(stored).filter((entry): entry is [string, string] => typeof entry[1] === "string" && UUID.test(entry[1])),
    )
}

/**
 * The anonymous id of this browser on the form of one site: a random id made once, kept first-party in this browser under the site key, and
 * sent with every submission so the shop sees the same visitor again. It holds nothing about the person. A browser that refuses storage
 * (private mode, blocked inside an embedding page) keeps the id in memory until the page closes; the form never fails because of storage.
 * Read at submit time in the browser, never while rendering on the server.
 */
export const websiteVisitorId = (siteKey: string): string => {
    const ids = keptIds()
    const stored = ids[siteKey]
    if (stored !== undefined) {
        held.set(siteKey, stored)
        return stored
    }
    const remembered = held.get(siteKey)
    if (remembered !== undefined) return remembered
    const made = crypto.randomUUID()
    held.set(siteKey, made)
    LocalStorage.set(StorageId.WebsiteVisitors, { ...ids, [siteKey]: made })
    return made
}
