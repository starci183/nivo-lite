import { Module, type DynamicModule, type Type } from "@nestjs/common"
import { McpModule } from "@modules/integrations/mcp"
import { NIVO_API_EXECUTOR, type NivoApiExecutor } from "@modules/domain/nivo-api"
import { ToolReceiptsModule } from "@modules/domain/tool-receipts"
import { McpSurfaceService } from "./mcp-surface.service"

/** What the app root hands the surface: the executor of the NIVO data ops (it runs each op's own application handler). */
export interface McpEndpointRegistration {
    /** The executor class; it reaches the handlers through the command and query buses. */
    readonly executor: Type<NivoApiExecutor>
}

@Module({})
/**
 * The OUTBOUND MCP endpoint (the mcp app): a thin surface for an outside AI client, as the holder of an API key. It holds no right and
 * no audit store of its own: an op runs its GraphQL operation's own application handler (the executor) and writes the one call log. It
 * offers no node tool: an agent's tools run only inside its graphs, in the api's engine.
 */
export class McpEndpointModule {
    /** Registers the surface once in the app that serves the endpoint. */
    static register(registration: McpEndpointRegistration): DynamicModule {
        return {
            module: McpEndpointModule,
            global: true,
            imports: [McpModule.register(), ToolReceiptsModule.register({})],
            providers: [McpSurfaceService, { provide: NIVO_API_EXECUTOR, useClass: registration.executor }],
            exports: [McpSurfaceService],
        }
    }
}
