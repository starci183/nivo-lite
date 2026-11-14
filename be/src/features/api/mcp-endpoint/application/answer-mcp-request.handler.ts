import { CommandHandler } from "@nestjs/cqrs"
import { McpSurfaceService, type SurfaceReply } from "@modules/domain/mcp-endpoint"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AnswerMcpRequestCommand } from "./answer-mcp-request.command"

@CommandHandler(AnswerMcpRequestCommand)
/** Answers one HTTP request of the outbound MCP endpoint; the surface refuses a key of another workspace than the path names. */
export class AnswerMcpRequestHandler extends ICQRSHandler<AnswerMcpRequestCommand, SurfaceReply> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly surface: McpSurfaceService,
    ) {
        super(logger)
    }

    protected override process(command: AnswerMcpRequestCommand): Promise<SurfaceReply> {
        return this.surface.answer({
            pathWorkspaceId: command.params.request.pathWorkspaceId,
            principal: { keyId: command.params.request.keyId, workspaceId: command.params.request.keyWorkspaceId },
            http: command.params.request.http,
        })
    }
}
