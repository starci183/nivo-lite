/**
 * What the records store needs of the core contacts (`contacts`, never a record): the contacts module implements it (engine -> contacts
 * port; the store never reads the contacts' tables). Optional: an app that binds none refuses every write of a contact field (it cannot
 * prove the contact) and reads a contact filter as written.
 */
export interface RecordContactsPort {
    /**
     * For each id the workspace holds as an ACTIVE contact, directly or through a merge, the id it stands for now (the survivor); an id
     * of no contact, of an erased one or of another workspace is absent from the answer.
     */
    currentOf(workspaceId: string, contactIds: ReadonlyArray<string>): Promise<ReadonlyMap<string, string>>
    /**
     * For each id, the contact it stands for now and every id merged into it (the contacts' ONE redirect): what a filter on a contact
     * field matches, so records written under a merged-away id follow the survivor at read time. An unknown id maps to itself.
     */
    aliasesOf(workspaceId: string, contactIds: ReadonlyArray<string>): Promise<ReadonlyMap<string, ReadonlyArray<string>>>
}

/** The injection token of the contacts the records store proves contact fields against. */
export const RECORD_CONTACTS: unique symbol = Symbol("RECORD_CONTACTS")
