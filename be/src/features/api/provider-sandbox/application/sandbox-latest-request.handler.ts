import { QueryHandler } from "@nestjs/cqrs"
import { ProviderSandboxAccountsService, type SandboxLatestRequest } from "@modules/domain/provider-sandbox"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { SandboxLatestRequestQuery } from "./provider-sandbox.queries"

@QueryHandler(SandboxLatestRequestQuery)
/** Asks for the request the agent last made of a sandbox account, read as inputs. */
export class SandboxLatestRequestHandler extends ICQRSHandler<SandboxLatestRequestQuery, SandboxLatestRequest | null> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly accounts: ProviderSandboxAccountsService,
    ) {
        super(logger)
    }

    protected override process(query: SandboxLatestRequestQuery): Promise<SandboxLatestRequest | null> {
        return this.accounts.latestRequest({ principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId }, query.params.request.connectionId)
    }
}
