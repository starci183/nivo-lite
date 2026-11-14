import { Module } from "@nestjs/common"
import { ContactsPageService } from "@modules/domain/contacts"
import { ContactModuleBlocksHandler } from "./application/contact-module-blocks.handler"
import { ReadContactsHandler } from "./application/read-contacts.handler"
import { ReadContactHandler } from "./application/read-contact.handler"
import { UpdateContactHandler } from "./application/update-contact.handler"
import { LinkContactIdentityHandler } from "./application/link-contact-identity.handler"
import { UnlinkContactIdentityHandler } from "./application/unlink-contact-identity.handler"
import { MergeContactsHandler } from "./application/merge-contacts.handler"
import { ForgetContactMemoryHandler } from "./application/forget-contact-memory.handler"
import { DeleteContactHandler } from "./application/delete-contact.handler"
import { ReadCustomerMessagesHandler } from "./application/read-customer-messages.handler"
import { ConfigurableModuleClass } from "./contacts.module-definition"

@Module({
    providers: [ContactsPageService, ContactModuleBlocksHandler, ReadContactsHandler, ReadContactHandler, UpdateContactHandler, LinkContactIdentityHandler, UnlinkContactIdentityHandler, MergeContactsHandler, ForgetContactMemoryHandler, DeleteContactHandler, ReadCustomerMessagesHandler],
})
/** The contacts feature: the /contacts page's reads and a person's decisions on the engine's contacts (`nivo.api.nivo.contact.*`). */
export class ContactsApiModule extends ConfigurableModuleClass {}
