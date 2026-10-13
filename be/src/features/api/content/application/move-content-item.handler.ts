import { CommandHandler } from "@nestjs/cqrs"
import { ContentEditorService } from "@modules/domain/content-items"
import type { ContentItem } from "@modules/domain/content-items"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MoveContentItemCommand } from "./move-content-item.command"

@CommandHandler(MoveContentItemCommand)
/** Delegates the authorized editor operation to its owning capability. */
export class MoveContentItemHandler extends ICQRSHandler<MoveContentItemCommand, ContentItem> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly content: ContentEditorService,
    ) {
        super(logger)
    }
    protected override process(command: MoveContentItemCommand): Promise<ContentItem> {
        return this.content.move(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.id,
            command.params.request.scheduledAt,
        )
    }
}
