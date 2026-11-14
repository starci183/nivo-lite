import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the contacts capability: the store's integrity and its identity rules, as a person's screen is told them. */
export enum ContactsErrorCode {
    /** The contact is not one of the workspace (unknown, erased, or of another workspace). */
    ContactMissing = "CONTACTS_CONTACT_MISSING",
    /** The identity is not one the contact holds. */
    IdentityMissing = "CONTACTS_IDENTITY_MISSING",
    /** The identifier cannot be written in its one canonical form. */
    IdentityInvalid = "CONTACTS_IDENTITY_INVALID",
    /** A verified channel or outside identity another contact holds: merge the two instead. */
    IdentityTaken = "CONTACTS_IDENTITY_TAKEN",
    /** A contact merged with itself. */
    SameContact = "CONTACTS_SAME_CONTACT",
    /** A record that points at the contact is still referenced (a restrict ref): the contact was not erased. */
    RecordsBlocked = "CONTACTS_RECORDS_BLOCKED",
}

/** How each contacts code travels. */
export const CONTACTS_ERROR_KINDS: Record<ContactsErrorCode, ErrorKind> = {
    [ContactsErrorCode.ContactMissing]: "not-found",
    [ContactsErrorCode.IdentityMissing]: "not-found",
    [ContactsErrorCode.IdentityInvalid]: "invalid",
    [ContactsErrorCode.IdentityTaken]: "conflict",
    [ContactsErrorCode.SameContact]: "invalid",
    [ContactsErrorCode.RecordsBlocked]: "conflict",
}

/** The typed error of the contacts capability. */
export class ContactsError extends DomainError<ContactsErrorCode> {}
