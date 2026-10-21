import { Module } from "@nestjs/common"
import { AnswerMcpRequestHandler } from "./application/answer-mcp-request.handler"
import { ConfigurableModuleClass } from "./mcp-endpoint.module-definition"

@Module({ providers: [AnswerMcpRequestHandler] })
/** The MCP endpoint feature: one JSON-RPC message of an agent answered by the workspace's gateway surface. */
export class McpEndpointModule extends ConfigurableModuleClass {}
