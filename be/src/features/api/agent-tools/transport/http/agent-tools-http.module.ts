import { Module } from "@nestjs/common"
import { AgentToolsApiModule } from "../../agent-tools.module"
import { ConfigurableModuleClass } from "./agent-tools-http.module-definition"
import { AgentToolsController } from "./agent-tools.controller"

@Module({
    imports: [AgentToolsApiModule.register({})],
    controllers: [AgentToolsController],
})
/** The HTTP transport of the agent tools feature. */
export class AgentToolsHttpModule extends ConfigurableModuleClass {}
