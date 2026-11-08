import { CommandHandler } from "@nestjs/cqrs"
import { ContentAiService, type ContentAiRequested } from "@modules/domain/content-ai"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { RequestContentQuickDraftCommand } from "./request-content-quick-draft.command"

@CommandHandler(RequestContentQuickDraftCommand)
/** Dispatches an authorized request to queued content work. */
export class RequestContentQuickDraftHandler extends ICQRSHandler<RequestContentQuickDraftCommand, ContentAiRequested> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly content: ContentAiService,
    ) {
        super(logger)
    }

    protected override process(command: RequestContentQuickDraftCommand): Promise<ContentAiRequested> {
        return this.content.requestQuickDraft(command.params.principal.id, command.params.request.workspaceId, {
            topic: command.params.request.topic,
            channels: command.params.request.channels,
        })
    }
}
