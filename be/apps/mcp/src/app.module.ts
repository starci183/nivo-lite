import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { APP_FILTER, APP_GUARD } from "@nestjs/core"
import { AuthGuard, CredentialGuard } from "@modules/domain/identity"
import { ErrorsFilter } from "@modules/platform/errors"
import { OriginGuard, RateLimitGuard } from "@modules/platform/http-security"
import { mcpModules } from "./compose/modules"
import type { McpAppOptions } from "./mcp.options"

@Module({})
/**
 * The composition root of the NIVO MCP gateway app: one MCP endpoint (Streamable HTTP) per workspace in front of every connector,
 * denied by default (rate limit, origin, the per-agent credential, then the session guard). Grants, approvals, limits, the breakers
 * and the audit live in the gateway modules, shared with the api's chat turns.
 */
export class AppModule {
    /** Builds the app from its parsed options. */
    static register(options: McpAppOptions): DynamicModule {
        return {
            module: AppModule,
            imports: [...mcpModules(options)],
            providers: [
                { provide: APP_FILTER, useClass: ErrorsFilter },
                { provide: APP_GUARD, useClass: RateLimitGuard },
                { provide: APP_GUARD, useClass: OriginGuard },
                { provide: APP_GUARD, useClass: CredentialGuard },
                { provide: APP_GUARD, useClass: AuthGuard },
            ],
        }
    }
}
