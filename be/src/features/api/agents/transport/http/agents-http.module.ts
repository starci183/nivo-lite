import { Module } from "@nestjs/common"
import { AgentsApiModule } from "../../agents.module"
import { AgentConnectionsController } from "./agent-connections.controller"
import { AgentDashboardController } from "./agent-dashboard.controller"
import { AgentEngineController } from "./agent-engine.controller"
import { AgentsController } from "./agents.controller"

@Module({
    imports: [AgentsApiModule],
    controllers: [AgentsController, AgentDashboardController, AgentEngineController, AgentConnectionsController],
})
/** The HTTP transport of the agents feature. */
export class AgentsHttpModule {}
