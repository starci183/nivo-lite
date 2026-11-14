/** One record a functional module keeps about a contact: its declared type and its id. */
export interface ContactRecordRef {
    /** The record type (`sales.lead`, `hiring.candidate`). */
    readonly type: string
    /** The record id. */
    readonly id: string
}

/** What erasing the records of a contact came to: how many records went (cascades included) and were cleared, or the ref that refused. */
export type ContactRecordsErasure =
    | { readonly kind: "erased"; readonly records: number; readonly cleared: number }
    | { readonly kind: "blocked"; readonly relation: string }

/**
 * The boundary between the core contact and the records that point at it (a record type's `contact` field): the records store
 * implements this port (record-files; the erase is a soft delete, so no file is removed), so the contacts never read the records' tables.
 * Optional: with no implementation bound, a contact has no records and deleting it erases none.
 */
export interface ContactRecordsPort {
    /** The records of the type that point at the contacts (the caller passes a contact and the ids merged into it), newest first. */
    recordsOf(workspaceId: string, contactIds: ReadonlyArray<string>, type: string): Promise<ReadonlyArray<ContactRecordRef>>
    /**
     * Erases, in one transaction across every agent, the records that point at the contacts (a field declared `erase`, the default),
     * or empties the field (`clear`): the erased records are soft-deleted and their files stay. A `restrict` ref to a record the
     * erase would remove refuses it (`blocked`) before anything is written.
     */
    erase(workspaceId: string, contactIds: ReadonlyArray<string>): Promise<ContactRecordsErasure>
}

/** The injection token of the module records of a contact. */
export const CONTACT_RECORDS: unique symbol = Symbol("CONTACT_RECORDS")
