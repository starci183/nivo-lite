import { QueryHandler } from "@nestjs/cqrs"
import { CrmConnectService, type CrmConnectionView } from "@modules/domain/data-hub"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { LoadCrmConnectionQuery } from "./load-crm-connection.query"

@QueryHandler(LoadCrmConnectionQuery)
/** Reads a saved CRM connection through the CrmConnectService. */
export class LoadCrmConnectionHandler extends ICQRSHandler<LoadCrmConnectionQuery, CrmConnectionView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly crm: CrmConnectService,
    ) {
        super(logger)
    }

    protected override process(query: LoadCrmConnectionQuery): Promise<CrmConnectionView> {
        const { request, principal } = query.params
        return this.crm.connection({ principalId: principal.id, workspaceId: request.workspaceId }, request.connectionId)
    }
}
