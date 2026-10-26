import { QueryHandler } from "@nestjs/cqrs"
import { OfficeRoomsService } from "@modules/domain/office-rooms"
import type { ConversationUnreadListView } from "@modules/domain/office-rooms"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListConversationUnreadQuery } from "./list-conversation-unread.query"

@QueryHandler(ListConversationUnreadQuery)
/** Answers the caller's unread counts of the direct conversations from the office rooms service. */
export class ListConversationUnreadHandler extends ICQRSHandler<
    ListConversationUnreadQuery,
    ConversationUnreadListView
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly rooms: OfficeRoomsService,
    ) {
        super(logger)
    }

    protected override process(query: ListConversationUnreadQuery): Promise<ConversationUnreadListView> {
        return this.rooms.unread(query.params.principal.id, query.params.request.workspaceId)
    }
}
