import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./agent-directory.module-definition"
import { AgentDirectoryService } from "./agent-directory.service"
import { AgentViewScopeService } from "./agent-view-scope.service"
import { AgentDeletionPauseService } from "./agent-deletion-pause.service"

@Module({
    providers: [AgentDirectoryService, AgentViewScopeService, AgentDeletionPauseService],
    exports: [AgentDirectoryService, AgentViewScopeService, AgentDeletionPauseService],
})
/** The agent lookups (and the scope of an agent's knowledge view) other capabilities read through, imported and exported by the agents module. */
export class AgentDirectoryModule extends ConfigurableModuleClass {}
