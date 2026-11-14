import { QueryHandler } from "@nestjs/cqrs"
import { ProviderSandboxAccountsService, type SandboxNextCase } from "@modules/domain/provider-sandbox"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { SandboxNextCasesQuery } from "./provider-sandbox.queries"

@QueryHandler(SandboxNextCasesQuery)
/** Asks for the account's next case of each outbound operation. */
export class SandboxNextCasesHandler extends ICQRSHandler<SandboxNextCasesQuery, ReadonlyArray<SandboxNextCase>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly accounts: ProviderSandboxAccountsService,
    ) {
        super(logger)
    }

    protected override process(query: SandboxNextCasesQuery): Promise<ReadonlyArray<SandboxNextCase>> {
        return this.accounts.nextCases({ principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId }, query.params.request.connectionId)
    }
}
