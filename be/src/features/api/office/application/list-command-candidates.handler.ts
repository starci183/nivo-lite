import { QueryHandler } from "@nestjs/cqrs"
import { OfficeCommandService } from "@modules/domain/office-command-candidates"
import type { CandidateView } from "@modules/domain/office-command-candidates"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListCommandCandidatesQuery } from "./list-command-candidates.query"

@QueryHandler(ListCommandCandidatesQuery)
/** Answers the command cards from the office command service. */
export class ListCommandCandidatesHandler extends ICQRSHandler<
    ListCommandCandidatesQuery,
    ReadonlyArray<CandidateView>
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly commands: OfficeCommandService,
    ) {
        super(logger)
    }

    protected override process(query: ListCommandCandidatesQuery): Promise<ReadonlyArray<CandidateView>> {
        return this.commands.list(query.params.principal.id, query.params.request.workspaceId)
    }
}
