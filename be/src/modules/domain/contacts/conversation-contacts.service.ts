import { Injectable } from "@nestjs/common"
import { CustomerRoutesService } from "@modules/domain/customer-routes"
import type { OptionalContactId } from "./contacts.contracts"

@Injectable()
/**
 * The contact of a conversation. The engine's conversation is a ROUTE (the person on an entrance), so the contact of one is read from the
 * route itself, as the person stands now (a merge is followed); the engine reads no chat record for it.
 */
export class ConversationContactsService {
    constructor(private readonly routes: CustomerRoutesService) {}

    /** The contact of a conversation (a route id), or null when the workspace holds no such route. */
    async contactOf(workspaceId: string, conversationId: string): Promise<OptionalContactId> {
        return (await this.routes.get(workspaceId, conversationId))?.contactId ?? null
    }
}
