import { Module } from "@nestjs/common"
import { AnswerMcpRequestHandler } from "./application/answer-mcp-request.handler"
import { ConfigurableModuleClass } from "./mcp-endpoint.module-definition"

@Module({ providers: [AnswerMcpRequestHandler] })
/**
 * The MCP endpoint feature: one HTTP request of an API key answered by the outbound surface. It names no other feature: the NIVO data
 * ops it runs are declared by the features that own them and listed by the app root (`NivoApiModule`).
 */
export class McpEndpointModule extends ConfigurableModuleClass {}
