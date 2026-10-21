import { CommandHandler } from "@nestjs/cqrs"
import { GatewaySurfaceService } from "@modules/domain/mcp-gateway"
import type { SurfaceReply } from "@modules/domain/mcp-gateway"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AnswerMcpRequestCommand } from "./answer-mcp-request.command"

@CommandHandler(AnswerMcpRequestCommand)
/** Answers one message of the gateway endpoint; the surface refuses a credential of another workspace. */
export class AnswerMcpRequestHandler extends ICQRSHandler<AnswerMcpRequestCommand, SurfaceReply> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly surface: GatewaySurfaceService,
    ) {
        super(logger)
    }

    protected override process(command: AnswerMcpRequestCommand): Promise<SurfaceReply> {
        return this.surface.answer({
            workspaceId: command.params.request.workspaceId,
            principal: {
                agentId: command.params.request.agentId,
                workspaceId: command.params.request.credentialWorkspaceId,
            },
            message: command.params.request.message,
        })
    }
}
