import { CommandHandler } from "@nestjs/cqrs"
import { type CritiqueReviewView, DocumentCritiqueAnswersService } from "@modules/domain/dossier-review"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { RetryBrainCritiqueCommand } from "./retry-brain-critique.command"

@CommandHandler(RetryBrainCritiqueCommand)
/** Asks for the critique of a document again. */
export class RetryBrainCritiqueHandler extends ICQRSHandler<RetryBrainCritiqueCommand, CritiqueReviewView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly answers: DocumentCritiqueAnswersService,
    ) {
        super(logger)
    }

    protected override process(command: RetryBrainCritiqueCommand): Promise<CritiqueReviewView> {
        return this.answers.retry(command.params.principal.id, command.params.request.workspaceId, command.params.request.sourceId)
    }
}
