import { CommandHandler } from "@nestjs/cqrs"
import type { OpenedSandbox } from "@modules/domain/provider-sandbox"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { OpenSandboxAccountCommand } from "./provider-sandbox.commands"
import { SandboxAttachmentsService } from "./sandbox-attachments.service"

@CommandHandler(OpenSandboxAccountCommand)
/** Opens a sandbox account of a provider and gives it to the agents named, in one action (none named: the account stands alone). */
export class OpenSandboxAccountHandler extends ICQRSHandler<OpenSandboxAccountCommand, OpenedSandbox> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly attachments: SandboxAttachmentsService,
    ) {
        super(logger)
    }

    protected override process(command: OpenSandboxAccountCommand): Promise<OpenedSandbox> {
        const { request, principal } = command.params
        return this.attachments.open(
            { principalId: principal.id, workspaceId: request.workspaceId },
            { provider: request.provider, name: request.name, attachTo: request.attachTo },
        )
    }
}
