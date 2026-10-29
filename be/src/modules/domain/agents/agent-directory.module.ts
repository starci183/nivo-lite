import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./agent-directory.module-definition"
import { AgentDirectoryService } from "./agent-directory.service"

@Module({
    providers: [AgentDirectoryService],
    exports: [AgentDirectoryService],
})
/** The agent lookups other capabilities read through, imported and exported by the agents module. */
export class AgentDirectoryModule extends ConfigurableModuleClass {}
