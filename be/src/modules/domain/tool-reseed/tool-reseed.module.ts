import { Module, type DynamicModule } from "@nestjs/common"
import { AgentRunDrainService } from "@modules/domain/agent-runs"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./tool-reseed.module-definition"
import { ToolReseedCommandService } from "./tool-reseed-command.service"
import { ToolReseedService } from "./tool-reseed.service"

@Module({})
/**
 * The re-seed of an install after the three-level tool rename (`cli tools reseed`): it only composes the capabilities the app already
 * registers globally (the agent graphs' store, the node rights, the grant stores, the installations, the workspaces), and the read-only
 * count of the runs and steps still open (`AgentRunDrainService`, on the core tables of the runs) it refuses `--execute` by.
 */
export class ToolReseedModule extends ConfigurableModuleClass {
    /** Registers the capability under the app that runs its command. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), AgentRunDrainService, ToolReseedService, ToolReseedCommandService],
            exports: [ToolReseedService, ToolReseedCommandService],
        }
    }
}
