import { QueryHandler } from "@nestjs/cqrs"
import { ContentMediaService } from "@modules/domain/content-media"
import type { ContentMediaData } from "@modules/domain/content-media"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetContentMediaQuery } from "./get-content-media.query"

@QueryHandler(GetContentMediaQuery)
/** Reads attachable files and addresses through the authorized media service. */
export class GetContentMediaHandler extends ICQRSHandler<GetContentMediaQuery, ContentMediaData> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly media: ContentMediaService,
    ) {
        super(logger)
    }

    protected override process(query: GetContentMediaQuery): Promise<ContentMediaData> {
        return this.media.read(query.params.principal.id, query.params.request.workspaceId, query.params.request)
    }
}
