import { QueryHandler } from "@nestjs/cqrs"
import { AccountDataPageService } from "@modules/domain/account-data"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import type { ConnectionAccountDataStats } from "./get-connection-account-data.contracts"
import { GetConnectionAccountDataQuery } from "./get-connection-account-data.query"

@QueryHandler(GetConnectionAccountDataQuery)
/**
 * Counts what an account keeps of its provider data through the AccountDataPageService, which proves the caller a manager of the
 * workspace and the connection one of that workspace (a connection of another workspace is not found).
 */
export class GetConnectionAccountDataHandler extends ICQRSHandler<GetConnectionAccountDataQuery, ConnectionAccountDataStats> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly accountData: AccountDataPageService,
    ) {
        super(logger)
    }

    protected override async process(query: GetConnectionAccountDataQuery): Promise<ConnectionAccountDataStats> {
        return this.accountData.statsFor(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request.connectionId,
        )
    }
}
