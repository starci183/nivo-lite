import { CommandHandler } from "@nestjs/cqrs"
import { KnowledgeSuggestionStateService } from "@modules/domain/knowledge-suggestion-state"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetKnowledgeSuggestionStateCommand } from "./set-knowledge-suggestion-state.command"

@CommandHandler(SetKnowledgeSuggestionStateCommand)
/** Marks a knowledge suggestion dismissed or not applicable, or brings it back. */
export class SetKnowledgeSuggestionStateHandler extends ICQRSHandler<SetKnowledgeSuggestionStateCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly suggestions: KnowledgeSuggestionStateService,
    ) {
        super(logger)
    }

    protected override process(command: SetKnowledgeSuggestionStateCommand): Promise<void> {
        return this.suggestions.decide(command.params.principal.id, command.params.request.workspaceId, command.params.request.key, command.params.request.state)
    }
}
