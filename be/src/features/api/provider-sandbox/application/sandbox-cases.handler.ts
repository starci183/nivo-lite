import { QueryHandler } from "@nestjs/cqrs"
import { ProviderSandboxAccountsService, type SandboxCase } from "@modules/domain/provider-sandbox"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { SandboxCasesQuery } from "./provider-sandbox.queries"

@QueryHandler(SandboxCasesQuery)
/** Asks for one provider's hardcoded cases (owner or manager, sandbox on). */
export class SandboxCasesHandler extends ICQRSHandler<SandboxCasesQuery, ReadonlyArray<SandboxCase>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly accounts: ProviderSandboxAccountsService,
    ) {
        super(logger)
    }

    protected override process(query: SandboxCasesQuery): Promise<ReadonlyArray<SandboxCase>> {
        return this.accounts.catalogue({ principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId }, query.params.request.provider)
    }
}
