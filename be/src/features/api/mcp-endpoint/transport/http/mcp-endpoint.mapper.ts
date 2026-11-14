import type { Request } from "express"
import type { CredentialPrincipal } from "@modules/domain/identity"
import type { McpHttpRequest } from "@modules/integrations/mcp"
import type { AnswerMcpRequestRequest } from "../../application/answer-mcp-request.contracts"

/** The request headers as one lower-case name → value map (a repeated header joined as HTTP joins it). */
const headersOf = (request: Request): Record<string, string> =>
    Object.fromEntries(
        Object.entries(request.headers).flatMap(([name, value]) =>
            value === undefined ? [] : [[name.toLowerCase(), Array.isArray(value) ? value.join(", ") : value]],
        ),
    )

/** The HTTP request as the MCP server side reads it: method, absolute URL, headers and the parsed JSON body. */
export const toMcpHttpRequest = (request: Request): McpHttpRequest => ({
    method: request.method,
    url: `${request.protocol}://${request.get("host") ?? "localhost"}${request.originalUrl}`,
    headers: headersOf(request),
    body: request.body,
})

/** Maps the path, the credential and the HTTP request to the application request. */
export const toAnswerMcpRequest = (
    pathWorkspaceId: string | null,
    principal: CredentialPrincipal,
    request: Request,
): AnswerMcpRequestRequest => ({
    pathWorkspaceId,
    keyId: principal.subject,
    keyWorkspaceId: principal.workspaceId,
    http: toMcpHttpRequest(request),
})
