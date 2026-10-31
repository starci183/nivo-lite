import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AgentTurnQueueModule } from "@modules/queues/agent-turn"
import { AgentDrainService } from "./agent-drain.service"
import { AgentGoalsService } from "./agent-goals.service"
import { AgentTurnsService } from "./agent-turns.service"
import { AgentTasksService } from "./agent-tasks.service"
import { AgentTriggersService } from "./agent-triggers.service"
import { AgentWakeService } from "./agent-wake.service"
import { AgentWorkAccessService } from "./agent-work-access.service"
import { AgentWorkHandlersService } from "./agent-work-handlers.service"
import { AgentWorkReadService } from "./agent-work-read.service"
import { AgentWorkSettingsService } from "./agent-work-settings.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-work.module-definition"

@Module({})
/**
 * Agents as data: the wake, the lease that lets one turn run per scope, the drain that runs it, and the goals, tasks, triggers and
 * switches an agent keeps. It owns the tables, imports platform and the agent-turn queue, and takes the turn executor and the
 * handlers from the capabilities that supply them, so a wake with none is held, not lost.
 */
export class AgentWorkModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), AgentTurnQueueModule.register({})],
            providers: [
                ...(base.providers ?? []),
                AgentWorkAccessService,
                AgentTurnsService,
                AgentWorkHandlersService,
                AgentWakeService,
                AgentDrainService,
                AgentGoalsService,
                AgentTasksService,
                AgentTriggersService,
                AgentWorkSettingsService,
                AgentWorkReadService,
            ],
            exports: [
                AgentWakeService,
                AgentDrainService,
                AgentTurnsService,
                AgentWorkHandlersService,
                AgentGoalsService,
                AgentTasksService,
                AgentTriggersService,
                AgentWorkSettingsService,
                AgentWorkReadService,
            ],
        }
    }
}
