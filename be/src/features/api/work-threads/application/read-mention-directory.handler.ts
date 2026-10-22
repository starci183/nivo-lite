import { QueryHandler } from "@nestjs/cqrs"
import { MentionDirectoryService } from "@modules/domain/thread-messages"
import type { MentionDirectory } from "@modules/domain/thread-messages"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ReadMentionDirectoryQuery } from "./read-mention-directory.query"

@QueryHandler(ReadMentionDirectoryQuery)
/** Answers the people, agents and groups a composer can tag through one domain-service call. */
export class ReadMentionDirectoryHandler extends ICQRSHandler<ReadMentionDirectoryQuery, MentionDirectory> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly directory: MentionDirectoryService,
    ) {
        super(logger)
    }

    protected override process(query: ReadMentionDirectoryQuery): Promise<MentionDirectory> {
        return this.directory.directory(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.locale,
        )
    }
}
