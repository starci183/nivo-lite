import type { DynamicModule } from "@nestjs/common"
import { McpEndpointHttpModule } from "@features/api/mcp-endpoint"
import { SystemHealthHttpModule } from "@features/api/system-health"
import { LivenessModule } from "@modules/domain/liveness"
import { McpGatewayModule } from "@modules/domain/mcp-gateway"
import { CqrsModule } from "@modules/platform/cqrs"
import { appPgTypes } from "@modules/integrations/data-sources"
import { ClockModule } from "@modules/platform/clock"
import { DatabaseModule } from "@modules/platform/database"
import { LoggingModule } from "@modules/platform/logging"
import type { McpAppOptions } from "../mcp.options"

/** Registers the mcp app capabilities in their boot order: the platform, the gateway over the primary database, health and the endpoint. */
export const mcpModules = (options: McpAppOptions): Array<DynamicModule> => [
    ClockModule.register({ isGlobal: true }),
    LoggingModule.register({ isGlobal: true }),
    DatabaseModule.register({ isGlobal: true, connections: [options.database], typeParsers: appPgTypes }),
    CqrsModule.register({ isGlobal: true }),
    LivenessModule.register({ isGlobal: true }),
    McpGatewayModule.register({ isGlobal: true, ...options.mcpGateway }),
    SystemHealthHttpModule.register({}),
    McpEndpointHttpModule.register({}),
]
