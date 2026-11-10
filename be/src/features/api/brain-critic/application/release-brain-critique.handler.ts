import { CommandHandler } from "@nestjs/cqrs"
import { type CritiqueServingView, DocumentCritiqueAnswersService } from "@modules/domain/dossier-review"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ReleaseBrainCritiqueCommand } from "./release-brain-critique.command"

@CommandHandler(ReleaseBrainCritiqueCommand)
/** Lets customers read a document whose critique could not finish (founder only). */
export class ReleaseBrainCritiqueHandler extends ICQRSHandler<ReleaseBrainCritiqueCommand, CritiqueServingView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly answers: DocumentCritiqueAnswersService,
    ) {
        super(logger)
    }

    protected override process(command: ReleaseBrainCritiqueCommand): Promise<CritiqueServingView> {
        return this.answers.release(command.params.principal.id, command.params.request.workspaceId, command.params.request.sourceId)
    }
}
