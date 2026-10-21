import type { CredentialPrincipal } from "@modules/domain/identity"
import type { SurfaceReply } from "@modules/domain/mcp-gateway"
import type { AnswerMcpRequestRequest } from "../../application/answer-mcp-request.contracts"
import type { McpEndpointPathRequest } from "./dto/mcp-endpoint-path.request"
import type { McpEndpointRequest } from "./dto/mcp-endpoint.request"
import type { McpEndpointResponse } from "./dto/mcp-endpoint.response"

/** Maps the path, the credential and the JSON-RPC body to the application request. */
export const toAnswerMcpRequest = (
    path: McpEndpointPathRequest,
    principal: CredentialPrincipal,
    body: McpEndpointRequest,
): AnswerMcpRequestRequest => ({
    workspaceId: path.workspaceId,
    agentId: principal.subject,
    credentialWorkspaceId: principal.workspaceId,
    message: { ...body },
})

/** Maps the surface's answer to the HTTP body: the JSON-RPC response, or nothing for a notification. */
export const toMcpEndpointResponse = (reply: SurfaceReply): McpEndpointResponse | null => reply.body
