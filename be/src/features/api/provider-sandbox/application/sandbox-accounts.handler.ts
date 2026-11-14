import { QueryHandler } from "@nestjs/cqrs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import type { SandboxAccountView } from "./provider-sandbox.contracts"
import { SandboxAccountsQuery } from "./provider-sandbox.queries"
import { SandboxAttachmentsService } from "./sandbox-attachments.service"

@QueryHandler(SandboxAccountsQuery)
/** Asks for the workspace's sandbox accounts with the agents each is attached to (owner or manager, sandbox on). */
export class SandboxAccountsHandler extends ICQRSHandler<SandboxAccountsQuery, ReadonlyArray<SandboxAccountView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly attachments: SandboxAttachmentsService,
    ) {
        super(logger)
    }

    protected override process(query: SandboxAccountsQuery): Promise<ReadonlyArray<SandboxAccountView>> {
        return this.attachments.list({ principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId })
    }
}
