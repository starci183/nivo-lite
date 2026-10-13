import { QueryHandler } from "@nestjs/cqrs"
import { OfficeThreadService } from "@modules/domain/office-command-candidates"
import type { MessagePage } from "@modules/domain/office-command-candidates"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListThreadMessagesQuery } from "./list-thread-messages.query"

@QueryHandler(ListThreadMessagesQuery)
/** Answers one page of the thread from the office thread service. */
export class ListThreadMessagesHandler extends ICQRSHandler<ListThreadMessagesQuery, MessagePage> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly thread: OfficeThreadService,
    ) {
        super(logger)
    }

    protected override process(query: ListThreadMessagesQuery): Promise<MessagePage> {
        return this.thread.messages(query.params.principal.id, query.params.request.workspaceId, query.params.request)
    }
}
