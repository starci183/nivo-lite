export { ContactsModule } from "./contacts.module"
export { CONTACTS_ERROR_KINDS, ContactsError, ContactsErrorCode } from "./errors/contacts.error"
export { CONTACTS_MESSAGES } from "./messages/contacts.messages"
export { ConversationContactsService } from "./conversation-contacts.service"
export { ContactsPageService } from "./contacts-page.service"
export { CONTACTS_PAGE_MAX, ContactsService } from "./contacts.service"
export { CONTACT_KEY, contactKeyOf } from "./contact-subject.policy"
export { CONTACT_MEMORY } from "./contact-memory.port"
export type { ContactMemoryNote, ContactMemoryPort, ContactMemoryReader, ContactMemoryView } from "./contact-memory.port"
export { CONTACT_RECORDS } from "./contact-records.port"
export { CONTACT_RUNS } from "./contact-runs.port"
export type { ContactRunsPort } from "./contact-runs.port"
export type { ContactRecordRef, ContactRecordsErasure, ContactRecordsPort } from "./contact-records.port"
export { CONTACTS_STORE } from "./contacts-store.port"
export { CONTACT_MEMORY_STORE } from "./contact-memory-store.port"
export { CONTACT_WORK_STORE } from "./contact-work-store.port"
export type { ContactWorkRow, ContactWorkStore } from "./contact-work-store.port"
export { CONTACT_WORK_MAX, ContactWorkService } from "./contact-work.service"
export type { ContactWorkStep } from "./contact-work.service"
export type {
    ContactMemoryEntry,
    ContactMemoryStore,
    ContactMemoryTx,
    ContactMemoryValues,
} from "./contact-memory-store.port"
export type {
    ContactEventWrite,
    ContactsPageAsk,
    ContactsStore,
    ContactsTx,
    ContactValues,
    IdentityWrite,
    StoredLinkToken,
} from "./contacts-store.port"
export { maskedValueOf, normaliseEmail, normalisePhone } from "./contact-identity.policy"
export type * from "./contacts.contracts"
export type {
    ContactDetailView,
    ContactsPageView,
    ContactView,
    DeleteContactRequest,
    ForgetContactMemoryRequest,
    LinkContactIdentityRequest,
    LinkContactIdentityView,
    MergeContactsRequest,
    ReadContactRequest,
    ReadContactsRequest,
    UnlinkContactIdentityRequest,
    UpdateContactRequest,
} from "./contacts-page.contracts"
export { contactsEntities } from "./persistence/entities"
