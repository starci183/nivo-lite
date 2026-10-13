import { CommandHandler } from "@nestjs/cqrs"
import { ContentEditorService } from "@modules/domain/content-items"
import type { ContentItem } from "@modules/domain/content-items"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveContentItemCommand } from "./save-content-item.command"

@CommandHandler(SaveContentItemCommand)
/** Delegates the authorized editor operation to its owning capability. */
export class SaveContentItemHandler extends ICQRSHandler<SaveContentItemCommand, ContentItem> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly content: ContentEditorService,
    ) {
        super(logger)
    }
    protected override process(command: SaveContentItemCommand): Promise<ContentItem> {
        return this.content.save(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.id,
            command.params.request.input,
        )
    }
}
