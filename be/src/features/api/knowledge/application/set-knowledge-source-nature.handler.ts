import { CommandHandler } from "@nestjs/cqrs"
import { DocumentNatureAnswerService, type NatureAnswered } from "@modules/domain/brain"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { SetKnowledgeSourceNatureCommand } from "./set-knowledge-source-nature.command"

@CommandHandler(SetKnowledgeSourceNatureCommand)
/** The founder says what a document is; every part of it is triaged again with his answer. */
export class SetKnowledgeSourceNatureHandler extends ICQRSHandler<SetKnowledgeSourceNatureCommand, NatureAnswered> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly answers: DocumentNatureAnswerService,
    ) {
        super(logger)
    }

    protected override process(command: SetKnowledgeSourceNatureCommand): Promise<NatureAnswered> {
        return this.answers.answer(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.sourceId,
            command.params.request.nature,
        )
    }
}
