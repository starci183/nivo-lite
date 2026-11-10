import { QueryHandler } from "@nestjs/cqrs"
import { type CritiqueView, DocumentCritiqueAnswersService } from "@modules/domain/dossier-review"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { GetBrainCritiqueQuery } from "./get-brain-critique.query"

@QueryHandler(GetBrainCritiqueQuery)
/** Reads the critique of one shop document. */
export class GetBrainCritiqueHandler extends ICQRSHandler<GetBrainCritiqueQuery, CritiqueView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly answers: DocumentCritiqueAnswersService,
    ) {
        super(logger)
    }

    protected override process(query: GetBrainCritiqueQuery): Promise<CritiqueView> {
        return this.answers.view(query.params.principal.id, query.params.request.workspaceId, query.params.request.sourceId, query.params.request.states)
    }
}
