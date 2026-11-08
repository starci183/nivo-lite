import { CommandHandler } from "@nestjs/cqrs"
import { ContentAiService, type ContentAiRequested } from "@modules/domain/content-ai"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { RequestContentDraftCommand } from "./request-content-draft.command"

@CommandHandler(RequestContentDraftCommand)
/** Dispatches an authorized request to queued content work. */
export class RequestContentDraftHandler extends ICQRSHandler<RequestContentDraftCommand, ContentAiRequested> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly content: ContentAiService,
    ) {
        super(logger)
    }

    protected override process(command: RequestContentDraftCommand): Promise<ContentAiRequested> {
        return this.content.requestDraft(command.params.principal.id, command.params.request.workspaceId, {
            id: command.params.request.id,
            hint: command.params.request.hint,
        })
    }
}
