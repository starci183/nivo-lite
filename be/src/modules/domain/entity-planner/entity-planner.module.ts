import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./entity-planner.module-definition"
import { EntityPlannerService } from "./entity-planner.service"
import { MigrationFilesClient } from "./migration-files.client"

@Module({})
/** Registers the entity planner once for the application (the cli). */
export class EntityPlannerModule extends ConfigurableModuleClass {
    /** Registers the capability and exports its service. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), EntityPlannerService, MigrationFilesClient],
            exports: [EntityPlannerService],
        }
    }
}
