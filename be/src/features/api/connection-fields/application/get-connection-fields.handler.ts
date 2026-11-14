import { QueryHandler } from "@nestjs/cqrs"
import { ConnectionFieldsService, type ConnectionFieldsView } from "@modules/domain/connection-fields"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { GetConnectionFieldsQuery } from "./get-connection-fields.query"

@QueryHandler(GetConnectionFieldsQuery)
/** Asks the connection form capability for the form of an account; the capability proves the member. */
export class GetConnectionFieldsHandler extends ICQRSHandler<GetConnectionFieldsQuery, ConnectionFieldsView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly fields: ConnectionFieldsService,
    ) {
        super(logger)
    }

    protected override process(query: GetConnectionFieldsQuery): Promise<ConnectionFieldsView> {
        return this.fields.fieldsOf(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request.connectionId,
        )
    }
}
