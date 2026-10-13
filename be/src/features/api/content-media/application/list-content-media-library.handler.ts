import { QueryHandler } from "@nestjs/cqrs"
import { ContentMediaService } from "@modules/domain/content-media"
import type { ContentLibraryFile } from "@modules/domain/content-media"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListContentMediaLibraryQuery } from "./list-content-media-library.query"

@QueryHandler(ListContentMediaLibraryQuery)
/** Lists the selected workspace's media through its authorized service. */
export class ListContentMediaLibraryHandler extends ICQRSHandler<
    ListContentMediaLibraryQuery,
    ReadonlyArray<ContentLibraryFile>
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly media: ContentMediaService,
    ) {
        super(logger)
    }

    protected override process(query: ListContentMediaLibraryQuery): Promise<ReadonlyArray<ContentLibraryFile>> {
        return this.media.library(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.limit,
        )
    }
}
