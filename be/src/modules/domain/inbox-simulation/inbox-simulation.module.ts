import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./inbox-simulation.module-definition"
import { InboxSimulationService } from "./inbox-simulation.service"
import { InboxSimulationWorkerService } from "./inbox-simulation-worker.service"

@Module({})
/** The simulator's request, status and worker orchestration over the existing inbound and decisions capabilities. */
export class InboxSimulationModule extends ConfigurableModuleClass {
    /** Registers the orchestration and its typed queue producer. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), InboxSimulationService, InboxSimulationWorkerService],
            exports: [InboxSimulationService, InboxSimulationWorkerService],
        }
    }
}
