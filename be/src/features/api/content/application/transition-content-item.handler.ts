import { CommandHandler } from "@nestjs/cqrs"
import { ContentEditorService } from "@modules/domain/content-items"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { TransitionContentItemCommand } from "./transition-content-item.command"
import type { TransitionContentItemResult } from "./transition-content-item.contracts"

@CommandHandler(TransitionContentItemCommand)
/** Delegates the authorized editor operation to its owning capability. */
export class TransitionContentItemHandler extends ICQRSHandler<
    TransitionContentItemCommand,
    TransitionContentItemResult
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly content: ContentEditorService,
    ) {
        super(logger)
    }
    protected override process(command: TransitionContentItemCommand): Promise<TransitionContentItemResult> {
        return this.content.transition(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.id,
            command.params.request.kind,
        )
    }
}
