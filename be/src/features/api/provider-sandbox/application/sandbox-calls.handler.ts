import { QueryHandler } from "@nestjs/cqrs"
import { ProviderSandboxAccountsService, type SandboxCall } from "@modules/domain/provider-sandbox"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { SandboxCallsQuery } from "./provider-sandbox.queries"

@QueryHandler(SandboxCallsQuery)
/** Asks for the account's call log, oldest first. */
export class SandboxCallsHandler extends ICQRSHandler<SandboxCallsQuery, ReadonlyArray<SandboxCall>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly accounts: ProviderSandboxAccountsService,
    ) {
        super(logger)
    }

    protected override process(query: SandboxCallsQuery): Promise<ReadonlyArray<SandboxCall>> {
        return this.accounts.calls({ principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId }, query.params.request.connectionId, query.params.request.operation)
    }
}
