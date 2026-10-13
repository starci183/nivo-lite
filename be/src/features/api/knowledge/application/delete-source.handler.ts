import { CommandHandler } from "@nestjs/cqrs"
import { BrainService } from "@modules/domain/brain"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DeleteSourceCommand } from "./delete-source.command"

@CommandHandler(DeleteSourceCommand)
/** Deletes the document through the brain service, which then withdraws the facts it contributed. */
export class DeleteSourceHandler extends ICQRSHandler<DeleteSourceCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly brain: BrainService,
    ) {
        super(logger)
    }

    protected override process(command: DeleteSourceCommand): Promise<void> {
        return this.brain.removeSource(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.sourceId,
        )
    }
}
