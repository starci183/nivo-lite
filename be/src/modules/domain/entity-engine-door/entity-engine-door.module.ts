import { Module, type DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./entity-engine-door.module-definition"
import { EngineDoorBindingService } from "./engine-door-binding.service"
import { EngineWorkflowService } from "./engine-workflow.service"
import { EngineDoorService } from "./engine-door.service"

@Module({})
/** Provides the `engine.door` port of declared jobs: a thin adapter onto the NIVO MCP gateway. */
export class EntityEngineDoorModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API composition root, after the MCP gateway. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), EngineDoorService, EngineDoorBindingService, EngineWorkflowService],
            exports: [EngineDoorService],
        }
    }
}
