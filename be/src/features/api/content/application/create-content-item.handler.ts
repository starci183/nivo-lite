import { CommandHandler } from "@nestjs/cqrs"
import { ContentEditorService } from "@modules/domain/content-items"
import type { ContentItem } from "@modules/domain/content-items"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CreateContentItemCommand } from "./create-content-item.command"

@CommandHandler(CreateContentItemCommand)
/** Delegates the authorized editor operation to its owning capability. */
export class CreateContentItemHandler extends ICQRSHandler<CreateContentItemCommand, ContentItem> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly content: ContentEditorService,
    ) {
        super(logger)
    }
    protected override process(command: CreateContentItemCommand): Promise<ContentItem> {
        return this.content.create(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.input,
        )
    }
}
