import { QueryHandler } from "@nestjs/cqrs"
import { ProviderSandboxAccountsService } from "@modules/domain/provider-sandbox"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { SandboxKeyQuery } from "./provider-sandbox.queries"

@QueryHandler(SandboxKeyQuery)
/** Asks for the account's sandbox key (owner or manager). */
export class SandboxKeyHandler extends ICQRSHandler<SandboxKeyQuery, string> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly accounts: ProviderSandboxAccountsService,
    ) {
        super(logger)
    }

    protected override process(query: SandboxKeyQuery): Promise<string> {
        return this.accounts.sandboxKey({ principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId }, query.params.request.connectionId)
    }
}
