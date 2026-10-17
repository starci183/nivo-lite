import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./agent-tools.module-definition"
import { GetToolManifestHandler } from "./application/get-tool-manifest.handler"
import { RunToolHandler } from "./application/run-tool.handler"

@Module({ providers: [GetToolManifestHandler, RunToolHandler] })
/** The agent tools feature: the handlers of its application. */
export class AgentToolsApiModule extends ConfigurableModuleClass {}
