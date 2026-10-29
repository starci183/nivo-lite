import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./agent-directory.module-definition"
import { AgentDirectoryService } from "./agent-directory.service"

@Module({
    providers: [AgentDirectoryService],
    exports: [AgentDirectoryService],
})
/** The agent lookups other capabilities read through, registrable on its own by an app that composes no agent lifecycle. */
export class AgentDirectoryModule extends ConfigurableModuleClass {}
