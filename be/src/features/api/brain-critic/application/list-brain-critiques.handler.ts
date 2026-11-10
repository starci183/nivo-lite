import { QueryHandler } from "@nestjs/cqrs"
import { type CritiqueSourceView, DocumentCritiqueAnswersService } from "@modules/domain/dossier-review"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ListBrainCritiquesQuery } from "./list-brain-critiques.query"

@QueryHandler(ListBrainCritiquesQuery)
/** Lists the critiqued documents of the workspace. */
export class ListBrainCritiquesHandler extends ICQRSHandler<ListBrainCritiquesQuery, ReadonlyArray<CritiqueSourceView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly answers: DocumentCritiqueAnswersService,
    ) {
        super(logger)
    }

    protected override process(query: ListBrainCritiquesQuery): Promise<ReadonlyArray<CritiqueSourceView>> {
        return this.answers.sources(query.params.principal.id, query.params.request.workspaceId)
    }
}
