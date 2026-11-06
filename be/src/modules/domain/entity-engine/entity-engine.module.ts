import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ModuleJobsQueueModule } from "@modules/queues/module-jobs"
import { ENGINE_FAILURE_ALERTS, ENTITY_ENGINE_OPTIONS } from "./entity-engine.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./entity-engine.module-definition"
import { EngineFailureService } from "./engine-failure.service"
import { EntityEngineService } from "./entity-engine.service"
import { EntityMutationService } from "./entity-mutation.service"
import { EntityPortsService } from "./entity-ports.service"
import { ListSourceService } from "./list-source.service"
import { ModuleJobRunnerService } from "./module-job-runner.service"

@Module({})
/** The generic entity engine over the records tables: the scoped transactions, the ports of blocks-core code, the generic list source and the runner of declared jobs. */
export class EntityEngineModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API composition root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), ModuleJobsQueueModule.register({})],
            providers: [
                ...(base.providers ?? []),
                { provide: ENTITY_ENGINE_OPTIONS, useValue: options },
                { provide: ENGINE_FAILURE_ALERTS, useClass: options.alerts },
                EngineFailureService,
                EntityEngineService,
                EntityMutationService,
                EntityPortsService,
                ListSourceService,
                ModuleJobRunnerService,
            ],
            exports: [
                EntityEngineService,
                EntityMutationService,
                EntityPortsService,
                ListSourceService,
                ModuleJobRunnerService,
            ],
        }
    }
}
