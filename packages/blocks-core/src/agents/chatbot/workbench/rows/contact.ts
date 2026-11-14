import { textOf, valueAt } from "../../../../shared/slots/paths"
import { THREAD_FIELDS } from "./inbox-fields"

/** What the contact pane of a conversation shows. */
export interface ContactView {
    /** The name of the customer. */
    readonly name: string
    /** The proper name of the channel the customer writes from. */
    readonly channelName: string
    /** The link of the customer's picture; empty when the channel gave none. */
    readonly avatar: string
    /** The person who holds the conversation; empty while the AI answers. */
    readonly handledBy: string
    /** The core contact behind the conversation; empty while no contact holds the customer. */
    readonly contactId: string
}

/** The contact of a conversation from its record, an unnamed visitor under the words given; null when the record is no conversation. */
export const contactOf = (record: unknown, untitled: string): ContactView | null => {
    const read = (key: keyof typeof THREAD_FIELDS): string => textOf(valueAt(record, THREAD_FIELDS[key]))
    if (read("id") === "") return null
    return {
        name: read("name") || untitled,
        channelName: read("channelName"),
        avatar: read("avatarUrl"),
        handledBy: read("handledBy"),
        contactId: read("contactId"),
    }
}
