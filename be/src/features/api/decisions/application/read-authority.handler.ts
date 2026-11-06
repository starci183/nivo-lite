import { QueryHandler } from "@nestjs/cqrs"
import { DecisionsService } from "@modules/domain/decisions"
import type { AuthoritySheet } from "@modules/domain/decisions"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ReadAuthorityQuery } from "./read-authority.query"

@QueryHandler(ReadAuthorityQuery)
/** Answers the authority sheet from the decisions service. */
export class ReadAuthorityHandler extends ICQRSHandler<ReadAuthorityQuery, AuthoritySheet> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly decisions: DecisionsService,
    ) {
        super(logger)
    }

    protected override process(query: ReadAuthorityQuery): Promise<AuthoritySheet> {
        return this.decisions.readAuthority(query.params.principal.id, query.params.request.workspaceId)
    }
}
