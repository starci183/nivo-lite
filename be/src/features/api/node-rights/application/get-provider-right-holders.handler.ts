import { QueryHandler } from "@nestjs/cqrs"
import { NodeRightRollupsService, type ProviderRightHolders } from "@modules/domain/node-right-rollups"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { GetProviderRightHoldersQuery } from "./get-provider-right-holders.query"

@QueryHandler(GetProviderRightHoldersQuery)
/** The rights tab of one connected account: every right of its provider with who holds it. The capability proves the member. */
export class GetProviderRightHoldersHandler extends ICQRSHandler<GetProviderRightHoldersQuery, ProviderRightHolders> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly rollups: NodeRightRollupsService,
    ) {
        super(logger)
    }

    protected override process(query: GetProviderRightHoldersQuery): Promise<ProviderRightHolders> {
        return this.rollups.providerHolders(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request.connectionId,
        )
    }
}
