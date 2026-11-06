import { textOf, valueAt } from "../../slots/paths"
import { THREAD_FIELDS } from "./inbox-fields"

/** What the contact pane of a conversation shows. */
export interface ContactView {
    /** The name of the customer. */
    readonly name: string
    /** The proper name of the channel the customer writes from. */
    readonly channelName: string
    /** The person who holds the conversation; empty while the AI answers. */
    readonly handledBy: string
    /** The stage of the customer; empty while the customer was not captured. */
    readonly stage: string
    /** What the customer needs; empty when unknown. */
    readonly need: string
    /** The phone of the customer; empty when unknown. */
    readonly phone: string
    /** The customer record behind the conversation; empty when the customer was not captured. */
    readonly leadId: string
}

/** The contact of a conversation from its record, an unnamed visitor under the words given; null when the record is no conversation. */
export const contactOf = (record: unknown, untitled: string): ContactView | null => {
    const read = (key: keyof typeof THREAD_FIELDS): string => textOf(valueAt(record, THREAD_FIELDS[key]))
    if (read("id") === "") return null
    return {
        name: read("name") || untitled,
        channelName: read("channelName"),
        handledBy: read("handledBy"),
        stage: read("stage"),
        need: read("need"),
        phone: read("phone"),
        leadId: read("leadId"),
    }
}

/** One known fact of the customer as a lead. */
export interface LeadFact {
    /** Which fact: the stage, the need or the phone. */
    readonly id: "stage" | "need" | "phone"
    /** The value: the stage key for the stage, else the words as they are. */
    readonly text: string
}

/** The facts of the customer as a lead, in the order the pane shows them, leaving out the ones not known. */
export const leadFactsOf = (contact: ContactView): ReadonlyArray<LeadFact> => {
    const known: ReadonlyArray<LeadFact> = [
        { id: "stage", text: contact.stage },
        { id: "need", text: contact.need },
        { id: "phone", text: contact.phone },
    ]
    return known.filter((fact) => fact.text !== "")
}
