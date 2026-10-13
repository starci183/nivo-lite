import { QueryHandler } from "@nestjs/cqrs"
import { ContentEditorService } from "@modules/domain/content-items"
import type { ContentActor } from "@modules/domain/content-items"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetContentActorQuery } from "./content-actor.query"

@QueryHandler(GetContentActorQuery)
/** Answers contentActor through the authorized content service. */
export class GetContentActorHandler extends ICQRSHandler<GetContentActorQuery, ContentActor> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly content: ContentEditorService,
    ) {
        super(logger)
    }

    protected override process(query: GetContentActorQuery): Promise<ContentActor> {
        return this.content.actor(query.params.principal.id, query.params.request.workspaceId)
    }
}
