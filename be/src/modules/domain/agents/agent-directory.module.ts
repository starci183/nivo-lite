import { Global, Module } from "@nestjs/common"
import { AgentDirectoryService } from "./agent-directory.service"

@Global()
@Module({
    providers: [AgentDirectoryService],
    exports: [AgentDirectoryService],
})
/** The agent lookups other capabilities read through, registrable on its own by an app that composes no agent lifecycle. */
export class AgentDirectoryModule {}
