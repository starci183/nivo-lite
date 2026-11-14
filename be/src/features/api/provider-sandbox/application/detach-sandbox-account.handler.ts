import { CommandHandler } from "@nestjs/cqrs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { DetachSandboxAccountCommand } from "./provider-sandbox.commands"
import type { SandboxAccountView } from "./provider-sandbox.contracts"
import { SandboxAttachmentsService } from "./sandbox-attachments.service"

@CommandHandler(DetachSandboxAccountCommand)
/** Detaches an agent from a sandbox account: its binding removed, then the attachment. */
export class DetachSandboxAccountHandler extends ICQRSHandler<DetachSandboxAccountCommand, SandboxAccountView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly attachments: SandboxAttachmentsService,
    ) {
        super(logger)
    }

    protected override process(command: DetachSandboxAccountCommand): Promise<SandboxAccountView> {
        const { request, principal } = command.params
        return this.attachments.detach({ principalId: principal.id, workspaceId: request.workspaceId }, request.connectionId, request.agentId)
    }
}
