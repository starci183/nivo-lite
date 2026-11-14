import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ContactBlocksRequest, ContactModuleAgentView } from "@modules/domain/workbench-door"
import type {
    ContactDetailView,
    ContactsPageView,
    ReadContactRequest,
    ReadContactsRequest,
} from "@modules/domain/contacts"
import type { LinePage } from "@modules/domain/customer-routes"
import type {
    ContactMessagesPageView,
    ContactRouteView,
    ContactWorkView,
    ReadContactMessagesRequest,
    ReadContactRoutesRequest,
    ReadContactWorkRequest,
} from "./contact-conversation.contracts"

/** `nivo.api.nivo.contact.list` / `.search`: a page of the people of the workspace, or the people a search finds. */
export class ReadContactsQuery extends Query<ContactsPageView> {
    constructor(readonly params: ExecuteParams<ReadContactsRequest>) {
        super()
    }
}

/** `nivo.api.nivo.contact.get` (with `.memory.list`): one contact, memory and suggestions. */
export class ReadContactQuery extends Query<ContactDetailView | null> {
    constructor(readonly params: ExecuteParams<ReadContactRequest>) {
        super()
    }
}

/** `nivo.api.nivo.contact.block.list`: what each installed agent's module knows about one person (the contact detail's module blocks). */
export class ContactModuleBlocksQuery extends Query<ReadonlyArray<ContactModuleAgentView>> {
    constructor(readonly params: ExecuteParams<ContactBlocksRequest>) {
        super()
    }
}

/** What a person asks of the conversation on one route: the route, the cursor of the page before, a lower limit in time, the most lines. */
export interface ReadCustomerMessagesRequest {
    /** The workspace the person reads in; a route of another workspace answers an empty page. */
    readonly workspaceId: string
    /** The route (one person on one channel) whose conversation is read. */
    readonly routeId: string
    /** The cursor of the page before: only lines older than it come back; absent or null starts at the newest. */
    readonly after?: string | null | undefined
    /** A lower limit in time (ISO date-time): lines said before it are left out; absent or null reads back to the start. */
    readonly since?: string | null | undefined
    /** The most lines one page holds; absent or null takes the service default. */
    readonly limit?: number | null | undefined
}

/** `nivo.api.nivo.customer.message.list`: the lines of one route, both directions, newest first (owner ruling R26). */
export class ReadCustomerMessagesQuery extends Query<LinePage> {
    constructor(readonly params: ExecuteParams<ReadCustomerMessagesRequest>) {
        super()
    }
}

/** The routes of one contact: the entrance of each, the activity on it, the agent whose workbench holds it and the member who holds it. */
export class ReadContactRoutesQuery extends Query<ReadonlyArray<ContactRouteView>> {
    constructor(readonly params: ExecuteParams<ReadContactRoutesRequest>) {
        super()
    }
}

/** The whole conversation with a person, every route merged by time (or one route), newest first, with who spoke each line. */
export class ReadContactMessagesQuery extends Query<ContactMessagesPageView> {
    constructor(readonly params: ExecuteParams<ReadContactMessagesRequest>) {
        super()
    }
}

/** What the agents did for a person lately, each row labelled in the workspace language. */
export class ReadContactWorkQuery extends Query<ReadonlyArray<ContactWorkView>> {
    constructor(readonly params: ExecuteParams<ReadContactWorkRequest>) {
        super()
    }
}
