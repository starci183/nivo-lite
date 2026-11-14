import { Injectable } from "@nestjs/common"
import { CustomerRoutesService } from "@modules/domain/customer-routes"

/** A customer conversation of a workspace as the public API reads it: the ROUTE of a person on an entrance. */
export interface PublicConversationRef {
    /** The conversation id: the route's id, what the engine's webhooks and events name. */
    readonly id: string
    /** The person the route reaches. */
    readonly contactId: string
    /** The channel of the entrance. */
    readonly channel: string
    /** The connection, site or API key of the entrance, or null. */
    readonly accountId: string | null
}

@Injectable()
/** The customer conversations the public API reads: the engine's routes. No chat record is read. */
export class PublicConversationsService {
    constructor(private readonly routes: CustomerRoutesService) {}

    /** A customer conversation of the workspace by its route id; another workspace's, or an id no route holds (a chat record id), is not found. */
    async find(workspaceId: string, conversationId: string): Promise<PublicConversationRef | undefined> {
        const route = await this.routes.get(workspaceId, conversationId)
        return route === null
            ? undefined
            : { id: route.id, contactId: route.contactId, channel: route.channel, accountId: route.accountId }
    }
}
