import { QueryHandler } from "@nestjs/cqrs"
import { ConnectionGrantsService, type BindableAgent } from "@modules/domain/connection-grants"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { BindableAgentsQuery } from "./bindable-agents.query"

@QueryHandler(BindableAgentsQuery)
/** Answers the bindable agents of a provider from the grants service. */
export class BindableAgentsHandler extends ICQRSHandler<BindableAgentsQuery, ReadonlyArray<BindableAgent>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly grants: ConnectionGrantsService,
    ) {
        super(logger)
    }

    protected override process(query: BindableAgentsQuery): Promise<ReadonlyArray<BindableAgent>> {
        return this.grants.bindableAgents(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.provider,
        )
    }
}
