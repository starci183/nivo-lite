/** The kind of the engine's subject when a run is about a person: the contact (`SubjectRef.kind`). */
export const CONTACT_KIND = "contact"

/** The prefix of a key the engine's own rows (memory entries, holds) keep a contact under: `contact:<id>`. */
export const CONTACT_KEY = "contact:"

/** The key of a contact in the engine's own rows. */
export const contactKeyOf = (contactId: string): string => `${CONTACT_KEY}${contactId}`
