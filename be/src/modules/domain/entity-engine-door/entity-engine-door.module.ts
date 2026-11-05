import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { syncAgentTurnsJob } from "./agent-turn-sync.policy"
import { ENTITY_ENGINE_DOOR_JOBS, ENTITY_ENGINE_DOOR_OPTIONS } from "./entity-engine-door.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./entity-engine-door.module-definition"
import { EngineDoorService } from "./engine-door.service"

@Module({})
/** Provides the `engine.door` port of declared jobs: a thin adapter onto the NIVO MCP gateway. */
export class EntityEngineDoorModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API composition root, after the MCP gateway. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: ENTITY_ENGINE_DOOR_OPTIONS, useValue: options },
                { provide: ENTITY_ENGINE_DOOR_JOBS, useValue: [syncAgentTurnsJob] },
                EngineDoorService,
            ],
            exports: [EngineDoorService, ENTITY_ENGINE_DOOR_JOBS],
        }
    }
}
