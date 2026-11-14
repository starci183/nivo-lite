import { ContactEventEntity } from "./contact-event.entity"
import { ContactIdentityEntity } from "./contact-identity.entity"
import { ContactLinkTokenEntity } from "./contact-link-token.entity"
import { ContactMemoryEntryEntity } from "./contact-memory-entry.entity"
import { ContactMergeEntity } from "./contact-merge.entity"
import { ContactEntity } from "./contact.entity"

export { ContactEntity, ContactEventEntity, ContactIdentityEntity, ContactLinkTokenEntity, ContactMemoryEntryEntity, ContactMergeEntity }

/** The entities the contacts capability owns, collected by the database module. */
export const contactsEntities: readonly [
    typeof ContactEntity,
    typeof ContactIdentityEntity,
    typeof ContactMergeEntity,
    typeof ContactLinkTokenEntity,
    typeof ContactEventEntity,
    typeof ContactMemoryEntryEntity,
] = [ContactEntity, ContactIdentityEntity, ContactMergeEntity, ContactLinkTokenEntity, ContactEventEntity, ContactMemoryEntryEntity] as const
