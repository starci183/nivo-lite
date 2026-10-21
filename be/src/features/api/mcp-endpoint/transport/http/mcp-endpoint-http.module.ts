import { Module } from "@nestjs/common"
import { McpEndpointModule } from "../../mcp-endpoint.module"
import { McpEndpointController } from "./mcp-endpoint.controller"
import { ConfigurableModuleClass } from "./mcp-endpoint-http.module-definition"

@Module({ imports: [McpEndpointModule.register({})], controllers: [McpEndpointController] })
/** The HTTP transport of the gateway's MCP endpoint; the gateway capability comes from the mcp app root. */
export class McpEndpointHttpModule extends ConfigurableModuleClass {}
