import { Module, type DynamicModule } from "@nestjs/common"
import { ModuleInstallationsModule } from "@modules/domain/module-installations"
import { ModuleJobsQueueModule } from "@modules/queues/module-jobs"
import { ENGINE_FAILURE_ALERTS, ENTITY_ENGINE_OPTIONS } from "./entity-engine.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./entity-engine.module-definition"
import { EngineFailureService } from "./engine-failure.service"
import { EntityEngineService } from "./entity-engine.service"
import { EntityMutationService } from "./entity-mutation.service"
import { EntityPortsService } from "./entity-ports.service"
import { ListSourceService } from "./list-source.service"
import { ModuleAgentService } from "./module-agent.service"
import { ModuleJobRunnerService } from "./module-job-runner.service"
import { EntityNodePortsService } from "./entity-node-ports.service"

@Module({})
/** The generic entity engine over the records tables: the scoped transactions, the ports of blocks-core code, the generic list source and the runner of declared jobs. */
export class EntityEngineModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API composition root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        if (options.storeOnly === true)
            return {
                ...base,
                imports: [...(base.imports ?? []), ModuleInstallationsModule.register({})],
                providers: [
                    ...(base.providers ?? []),
                    { provide: ENTITY_ENGINE_OPTIONS, useValue: options },
                    EngineFailureService,
                    EntityEngineService,
                    EntityMutationService,
                    ModuleAgentService,
                ],
                exports: [EntityEngineService, EntityMutationService, ModuleAgentService],
            }
        return {
            ...base,
            imports: [
                ...(base.imports ?? []),
                ModuleJobsQueueModule.register({}),
                ModuleInstallationsModule.register({}),
            ],
            providers: [
                ...(base.providers ?? []),
                { provide: ENTITY_ENGINE_OPTIONS, useValue: options },
                { provide: ENGINE_FAILURE_ALERTS, useClass: options.alerts },
                EngineFailureService,
                EntityEngineService,
                EntityMutationService,
                EntityPortsService,
                ListSourceService,
                ModuleAgentService,
                ModuleJobRunnerService,
                EntityNodePortsService,
            ],
            exports: [
                EntityEngineService,
                EntityMutationService,
                EntityPortsService,
                ListSourceService,
                ModuleAgentService,
                ModuleJobRunnerService,
                EntityNodePortsService,
                ModuleJobsQueueModule,
            ],
        }
    }
}
