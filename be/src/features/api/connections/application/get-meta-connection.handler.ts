import { QueryHandler } from "@nestjs/cqrs"
import { MetaConnectionsService, type MetaWizardConnection } from "@modules/domain/meta-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { GetMetaConnectionQuery } from "./get-meta-connection.query"

@QueryHandler(GetMetaConnectionQuery)
/** Asks for the wizard view of a Meta connection through the MetaConnectionsService. */
export class GetMetaConnectionHandler extends ICQRSHandler<GetMetaConnectionQuery, MetaWizardConnection> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly meta: MetaConnectionsService,
    ) {
        super(logger)
    }

    protected override process(query: GetMetaConnectionQuery): Promise<MetaWizardConnection> {
        return this.meta.resume(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request.connectionId,
        )
    }
}
