import { Command } from "@nestjs/cqrs"
import type { SurfaceReply } from "@modules/domain/mcp-gateway"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { AnswerMcpRequestRequest } from "./answer-mcp-request.contracts"

/** Asks the gateway surface of a workspace to answer one JSON-RPC message of an authenticated agent. */
export class AnswerMcpRequestCommand extends Command<SurfaceReply> {
    constructor(readonly params: PublicExecuteParams<AnswerMcpRequestRequest>) {
        super()
    }
}
