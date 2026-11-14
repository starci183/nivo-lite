import { mapSlot } from "@/hooks/slot"
import { QUERY_CONTACT_MODULE_BLOCKS_SWR_KEY, QUERY_CONTACT_SWR_KEY, QUERY_CONTACTS_SWR_KEY } from "@/hooks/swr"
import { detailOf, type ContactDetailWire } from "@/modules/contacts"
import { mutate } from "@/modules/viewer-cache"
import type { ContactDetailView, ContactWords, DataSlot } from "@/modules/types"

/** The reads that show a person or the list of people: a change to a person revalidates both. */
const CONTACT_KEYS: ReadonlySet<string> = new Set([
    QUERY_CONTACT_SWR_KEY,
    QUERY_CONTACTS_SWR_KEY,
    QUERY_CONTACT_MODULE_BLOCKS_SWR_KEY,
])

/** Revalidates the list and the open person after a change to a person. */
export const refreshContacts = async (): Promise<void> => {
    await mutate((key) => Array.isArray(key) && typeof key[0] === "string" && CONTACT_KEYS.has(key[0]))
}

/** The catalog key (`contacts` namespace) that says what linking an identity did. */
export const LINK_OUTCOME_KEYS = {
    linked: "linkedLinked",
    proposed: "linkedProposed",
    merged: "linkedMerged",
} as const

/** The catalog key that says what linking did; an outcome the page does not know says the plain "linked". */
export const linkOutcomeKeyOf = (outcome: string): (typeof LINK_OUTCOME_KEYS)[keyof typeof LINK_OUTCOME_KEYS] =>
    outcome === "proposed" || outcome === "merged" ? LINK_OUTCOME_KEYS[outcome] : LINK_OUTCOME_KEYS.linked

/** What the detail of a person is worded and filtered with. */
interface DetailSlotOptions {
    readonly canDelete: boolean
    /** Suggestions the viewer dismissed this visit: they are left out. */
    readonly dismissed: ReadonlySet<string>
}

/** The open person's slot, worded and with the dismissed suggestions left out; the slot keeps its status (loading, failed, gone). */
export const detailSlotOf = (
    slot: DataSlot<ContactDetailWire> | null,
    words: ContactWords,
    options: DetailSlotOptions,
): DataSlot<ContactDetailView> | null =>
    slot === null
        ? null
        : mapSlot(slot, (raw) => {
              const view = detailOf(raw, words, { canDelete: options.canDelete })
              return { ...view, suggestions: view.suggestions.filter((one) => !options.dismissed.has(one.contactId)) }
          })
