import { Command } from "@nestjs/cqrs"
import type { SurfaceReply } from "@modules/domain/mcp-endpoint"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { AnswerMcpRequestRequest } from "./answer-mcp-request.contracts"

/** Asks the outbound MCP surface to answer one HTTP request of an authenticated API key. */
export class AnswerMcpRequestCommand extends Command<SurfaceReply> {
    constructor(readonly params: PublicExecuteParams<AnswerMcpRequestRequest>) {
        super()
    }
}
