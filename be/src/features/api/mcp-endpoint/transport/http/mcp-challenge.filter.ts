import { Catch, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common"
import type { Request, Response } from "express"
import { InjectErrorsService, type ErrorsService } from "@modules/platform/errors"
import { InjectRequestLocale, type RequestLocale } from "@modules/platform/i18n"

/** The challenge a refused MCP request carries: a bearer API key (OAuth for claude.ai connectors comes later). */
export const MCP_BEARER_CHALLENGE = 'Bearer realm="nivo-mcp", error="invalid_token"'

/** The status of an unauthenticated request. */
const UNAUTHORIZED = 401

@Catch()
/**
 * The exception filter of the MCP endpoint: the same `{ code, kind, message, params }` answer as the app's one REST filter, plus the
 * `WWW-Authenticate: Bearer` challenge on a 401 (a missing, unknown or revoked key), as HTTP authentication and MCP clients expect.
 */
export class McpChallengeFilter implements ExceptionFilter {
    constructor(
        @InjectErrorsService() private readonly errors: ErrorsService,
        @InjectRequestLocale() private readonly requestLocale: RequestLocale,
    ) {}

    /** Writes the description of `exception`, with the challenge on a 401. */
    catch(exception: unknown, host: ArgumentsHost): void {
        const http = host.switchToHttp()
        const request = http.getRequest<Request>()
        const response = http.getResponse<Response>()
        const description = this.errors.describe(exception, {
            scope: "http",
            context: { route: request.path, method: request.method, connectionId: null },
        })
        if (description.status === UNAUTHORIZED) response.setHeader("WWW-Authenticate", MCP_BEARER_CHALLENGE)
        const locale = this.requestLocale.of(request.headers["accept-language"])
        response.status(description.status).json({
            code: description.code,
            kind: description.kind,
            message: this.errors.text(description.code, description.params, locale),
            params: description.params,
        })
    }
}
