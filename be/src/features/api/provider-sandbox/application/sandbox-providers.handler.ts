import { QueryHandler } from "@nestjs/cqrs"
import { ProviderSandboxAccountsService } from "@modules/domain/provider-sandbox"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { SandboxProvidersQuery } from "./provider-sandbox.queries"

@QueryHandler(SandboxProvidersQuery)
/** Asks which providers ship a sandbox catalogue (owner or manager, sandbox on). */
export class SandboxProvidersHandler extends ICQRSHandler<SandboxProvidersQuery, ReadonlyArray<string>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly accounts: ProviderSandboxAccountsService,
    ) {
        super(logger)
    }

    protected override process(query: SandboxProvidersQuery): Promise<ReadonlyArray<string>> {
        return this.accounts.providers({ principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId })
    }
}
