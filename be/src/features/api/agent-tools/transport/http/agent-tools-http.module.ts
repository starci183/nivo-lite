import { Module } from "@nestjs/common"
import { AgentToolsApiModule } from "../../agent-tools.module"
import { AgentToolsController } from "./agent-tools.controller"

@Module({
    imports: [AgentToolsApiModule],
    controllers: [AgentToolsController],
})
/** The HTTP transport of the agent tools feature. */
export class AgentToolsHttpModule {}
