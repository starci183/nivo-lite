import { CommandHandler } from "@nestjs/cqrs"
import { type CritiquePointView, DocumentCritiqueAnswersService } from "@modules/domain/dossier-review"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AnswerBrainCritiqueCommand } from "./answer-brain-critique.command"

@CommandHandler(AnswerBrainCritiqueCommand)
/** Answers one point of a critique (founder only); never applies a truth. */
export class AnswerBrainCritiqueHandler extends ICQRSHandler<AnswerBrainCritiqueCommand, CritiquePointView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly answers: DocumentCritiqueAnswersService,
    ) {
        super(logger)
    }

    protected override process(command: AnswerBrainCritiqueCommand): Promise<CritiquePointView> {
        return this.answers.answer(command.params.principal.id, command.params.request)
    }
}
