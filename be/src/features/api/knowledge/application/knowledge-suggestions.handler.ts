import { QueryHandler } from "@nestjs/cqrs"
import { KnowledgeSuggestionStateService } from "@modules/domain/knowledge-suggestion-state"
import type { SuggestionContext } from "@modules/domain/knowledge-suggestion-state"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { KnowledgeSuggestionsQuery } from "./knowledge-suggestions.query"

@QueryHandler(KnowledgeSuggestionsQuery)
/** Reads what the workspace decided about its knowledge suggestions and its business type. */
export class KnowledgeSuggestionsHandler extends ICQRSHandler<KnowledgeSuggestionsQuery, SuggestionContext> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly suggestions: KnowledgeSuggestionStateService,
    ) {
        super(logger)
    }

    protected override process(query: KnowledgeSuggestionsQuery): Promise<SuggestionContext> {
        return this.suggestions.context(query.params.principal.id, query.params.request.workspaceId)
    }
}
