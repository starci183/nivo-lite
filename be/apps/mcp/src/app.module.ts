import { Module, type DynamicModule } from "@nestjs/common"
import { APP_FILTER, APP_GUARD } from "@nestjs/core"
import { AuthGuard, CredentialGuard } from "@modules/domain/identity"
import { ErrorsFilter } from "@modules/platform/errors"
import { OriginGuard, RateLimitGuard } from "@modules/platform/http-security"
import { mcpModules } from "./compose/modules"
import type { McpAppOptions } from "./mcp.options"

@Module({})
/**
 * The composition root of the NIVO MCP app: the outbound MCP endpoint (Streamable HTTP) an outside AI client reaches with an MCP key,
 * denied by default (rate limit, origin, the key's credential, then the session guard). A thin protocol surface: NIVO's data ops and
 * the agent and workflow ops, each through its GraphQL operation's own handler; it loads no provider and runs no tool and no graph.
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
