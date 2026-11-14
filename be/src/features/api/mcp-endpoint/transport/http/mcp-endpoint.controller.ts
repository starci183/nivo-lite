import { All, Controller, Param, Req, Res, UseFilters } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import type { Request, Response } from "express"
import { Credential, CurrentCredentialPrincipal, type CredentialPrincipal } from "@modules/domain/identity"
import type { SurfaceReply } from "@modules/domain/mcp-endpoint"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { AnswerMcpRequestCommand } from "../../application/answer-mcp-request.command"
import { McpEndpointPathRequest } from "./dto/mcp-endpoint-path.request"
import { McpChallengeFilter } from "./mcp-challenge.filter"
import { toAnswerMcpRequest } from "./mcp-endpoint.mapper"

/** Writes the SDK's HTTP answer back as it is: status, headers, body (none for a 202 or a 405). */
const write = (response: Response, reply: SurfaceReply): void => {
    response.status(reply.status)
    for (const [name, value] of Object.entries(reply.headers)) response.setHeader(name, value)
    response.send(reply.body)
}

@Controller("mcp")
@UseFilters(McpChallengeFilter)
/**
 * The outbound MCP endpoint (stateless Streamable HTTP, JSON responses): `POST /mcp`, the canonical URL (the key names its workspace),
 * and `POST /mcp/:workspaceId`, which must name the key's own workspace. The door takes an MCP key (`tool-token` of the `mcp-gateway`
 * workflow): nothing the caller declares is trusted; a missing, unknown or revoked key is answered 401 with a `WWW-Authenticate: Bearer`
 * challenge before any op runs. GET and DELETE are answered 405 (no SSE stream, no session).
 */
export class McpEndpointController {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Answers one HTTP request of an authenticated key on the canonical URL. */
    @All()
    @Credential({ kind: "tool-token", workflow: "mcp-gateway" })
    async answer(
        @CurrentCredentialPrincipal() principal: CredentialPrincipal,
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const reply = await this.commandBus.execute(
            new AnswerMcpRequestCommand({ request: toAnswerMcpRequest(null, principal, request) }),
        )
        write(response, reply)
    }

    /** Answers one HTTP request of an authenticated key on the workspace's URL (the key must act for that workspace). */
    @All(":workspaceId")
    @Credential({ kind: "tool-token", workflow: "mcp-gateway" })
    async answerForWorkspace(
        @Param() path: McpEndpointPathRequest,
        @CurrentCredentialPrincipal() principal: CredentialPrincipal,
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const reply = await this.commandBus.execute(
            new AnswerMcpRequestCommand({ request: toAnswerMcpRequest(path.workspaceId, principal, request) }),
        )
        write(response, reply)
    }
}
