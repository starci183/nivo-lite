import { NIVO_API } from "@nivo-lite/agent-sdk/names"
import type { NivoApiOpGroup } from "@modules/domain/nivo-api"
import { ContactsPageService } from "@modules/domain/contacts"
import { ContactModuleBlocksHandler } from "./application/contact-module-blocks.handler"
import {
    DeleteContactCommand,
    ForgetContactMemoryCommand,
    LinkContactIdentityCommand,
    MergeContactsCommand,
    UnlinkContactIdentityCommand,
    UpdateContactCommand,
} from "./application/contacts.commands"
import { ContactModuleBlocksQuery, ReadContactQuery, ReadContactsQuery, ReadCustomerMessagesQuery } from "./application/contacts.queries"
import { ReadCustomerMessagesHandler } from "./application/read-customer-messages.handler"
import { DeleteContactHandler } from "./application/delete-contact.handler"
import { ForgetContactMemoryHandler } from "./application/forget-contact-memory.handler"
import { LinkContactIdentityHandler } from "./application/link-contact-identity.handler"
import { MergeContactsHandler } from "./application/merge-contacts.handler"
import { ReadContactHandler } from "./application/read-contact.handler"
import { ReadContactsHandler } from "./application/read-contacts.handler"
import { UnlinkContactIdentityHandler } from "./application/unlink-contact-identity.handler"
import { UpdateContactHandler } from "./application/update-contact.handler"

/** The contact ops of the outbound MCP surface: the message each op sends to the contacts handlers (the same ones the contacts resolvers send), with those handlers. */
export const CONTACTS_NIVO_API_OPS: NivoApiOpGroup = {
    handlers: [
        ContactsPageService,
        ReadContactsHandler,
        ReadContactHandler,
        UpdateContactHandler,
        LinkContactIdentityHandler,
        UnlinkContactIdentityHandler,
        MergeContactsHandler,
        ForgetContactMemoryHandler,
        DeleteContactHandler,
        ContactModuleBlocksHandler,
        ReadCustomerMessagesHandler,
    ],
    queries: {
        [NIVO_API.contact.list]: ReadContactsQuery,
        [NIVO_API.contact.get]: ReadContactQuery,
        [NIVO_API.contact.blockList]: ContactModuleBlocksQuery,
        [NIVO_API.customerMessage.list]: ReadCustomerMessagesQuery,
    },
    commands: {
        [NIVO_API.contact.update]: UpdateContactCommand,
        [NIVO_API.contact.identityLink]: LinkContactIdentityCommand,
        [NIVO_API.contact.identityUnlink]: UnlinkContactIdentityCommand,
        [NIVO_API.contact.merge]: MergeContactsCommand,
        [NIVO_API.contact.memoryForget]: ForgetContactMemoryCommand,
        [NIVO_API.contact.delete]: DeleteContactCommand,
    },
}
