import { QueryHandler } from "@nestjs/cqrs"
import { ContentEditorService } from "@modules/domain/content-items"
import type { ContentWorkbench } from "@modules/domain/content-items"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetContentWorkbenchQuery } from "./content-workbench.query"

@QueryHandler(GetContentWorkbenchQuery)
/** Answers contentWorkbench through the authorized content service. */
export class GetContentWorkbenchHandler extends ICQRSHandler<GetContentWorkbenchQuery, ContentWorkbench> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly content: ContentEditorService,
    ) {
        super(logger)
    }

    protected override process(query: GetContentWorkbenchQuery): Promise<ContentWorkbench> {
        return this.content.workbench(query.params.principal.id, query.params.request.workspaceId)
    }
}
