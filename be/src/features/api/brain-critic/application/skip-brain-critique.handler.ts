import { CommandHandler } from "@nestjs/cqrs"
import { type CritiquePointView, DocumentCritiqueAnswersService } from "@modules/domain/dossier-review"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { SkipBrainCritiqueCommand } from "./skip-brain-critique.command"

@CommandHandler(SkipBrainCritiqueCommand)
/** Skips one point of a critique. */
export class SkipBrainCritiqueHandler extends ICQRSHandler<SkipBrainCritiqueCommand, CritiquePointView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly answers: DocumentCritiqueAnswersService,
    ) {
        super(logger)
    }

    protected override process(command: SkipBrainCritiqueCommand): Promise<CritiquePointView> {
        return this.answers.skip(command.params.principal.id, command.params.request.workspaceId, command.params.request.findingId, command.params.request.reason)
    }
}
