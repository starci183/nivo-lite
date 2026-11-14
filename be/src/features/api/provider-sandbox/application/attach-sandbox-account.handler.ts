import { CommandHandler } from "@nestjs/cqrs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AttachSandboxAccountCommand } from "./provider-sandbox.commands"
import type { SandboxAccountView } from "./provider-sandbox.contracts"
import { SandboxAttachmentsService } from "./sandbox-attachments.service"

@CommandHandler(AttachSandboxAccountCommand)
/** Attaches an agent to a sandbox account: attached, bound where it may be, the provider's triggers on. */
export class AttachSandboxAccountHandler extends ICQRSHandler<AttachSandboxAccountCommand, SandboxAccountView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly attachments: SandboxAttachmentsService,
    ) {
        super(logger)
    }

    protected override process(command: AttachSandboxAccountCommand): Promise<SandboxAccountView> {
        const { request, principal } = command.params
        return this.attachments.attach({ principalId: principal.id, workspaceId: request.workspaceId }, request.connectionId, request.agentId)
    }
}
