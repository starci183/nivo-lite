import { QueryHandler } from "@nestjs/cqrs"
import { ContextNotesService } from "@modules/domain/module-context-notes"
import type { ContextNote } from "@modules/domain/module-context-notes"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ContextNotesQuery } from "./context-notes.query"

@QueryHandler(ContextNotesQuery)
/** Answers the pending notes from the context-notes service. */
export class ContextNotesHandler extends ICQRSHandler<ContextNotesQuery, ReadonlyArray<ContextNote>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly notes: ContextNotesService,
    ) {
        super(logger)
    }

    protected override process(query: ContextNotesQuery): Promise<ReadonlyArray<ContextNote>> {
        return this.notes.pending(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.installationId,
        )
    }
}
