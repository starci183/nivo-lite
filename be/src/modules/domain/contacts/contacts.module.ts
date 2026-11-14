import { Module, type DynamicModule } from "@nestjs/common"
import { CONTACT_MEMORY_STORE } from "./contact-memory-store.port"
import { TypeormContactMemoryStore } from "./contact-memory-store.typeorm"
import { CONTACTS_STORE } from "./contacts-store.port"
import { TypeormContactsStore } from "./contacts-store.typeorm"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./contacts.module-definition"
import { ContactsService } from "./contacts.service"
import { ConversationContactsService } from "./conversation-contacts.service"
import { RECORD_CONTACTS } from "@modules/domain/entity-engine/record-contacts.port"
import { RecordContactsAdapter } from "./record-contacts.adapter"

@Module({})
/**
 * The engine's contacts: every person the agents work with, their identities, merges (one redirect table) and the audit. A leaf on the
 * primary connection: the intake, the engine's subject, the contact tools and the contacts page all hold it. The memory of a contact is
 * its table here (`CONTACT_MEMORY_STORE`), read and written by the engine's memory service, bound back through `CONTACT_MEMORY`; the records that point at a contact are
 * the records store's, bound through `CONTACT_RECORDS` (record-files). It provides `RECORD_CONTACTS`, the contacts the records store
 * proves a contact field against.
 */
export class ContactsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                TypeormContactsStore,
                { provide: CONTACTS_STORE, useExisting: TypeormContactsStore },
                // The memory of the contacts (public.contact_memory): the engine's memory service reads and writes it through this store.
                TypeormContactMemoryStore,
                { provide: CONTACT_MEMORY_STORE, useExisting: TypeormContactMemoryStore },
                ContactsService,
                ConversationContactsService,
                // The contacts the records store proves a contact field against (the engine's port, implemented here).
                RecordContactsAdapter,
                { provide: RECORD_CONTACTS, useExisting: RecordContactsAdapter },
            ],
            exports: [ContactsService, ConversationContactsService, CONTACTS_STORE, CONTACT_MEMORY_STORE, RECORD_CONTACTS],
        }
    }
}
