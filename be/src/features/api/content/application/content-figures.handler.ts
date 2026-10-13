import { QueryHandler } from "@nestjs/cqrs"
import { ContentEditorService } from "@modules/domain/content-items"
import type { ContentFigures } from "@modules/domain/content-items"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetContentFiguresQuery } from "./content-figures.query"

@QueryHandler(GetContentFiguresQuery)
/** Answers contentFigures through the authorized content service. */
export class GetContentFiguresHandler extends ICQRSHandler<GetContentFiguresQuery, ContentFigures> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly content: ContentEditorService,
    ) {
        super(logger)
    }

    protected override process(query: GetContentFiguresQuery): Promise<ContentFigures> {
        return this.content.figures(query.params.principal.id, query.params.request.workspaceId)
    }
}
