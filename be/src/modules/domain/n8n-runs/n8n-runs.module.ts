import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { N8nQueueModule } from "@modules/queues/n8n"
import { N8nDataService } from "./n8n-data.service"
import { N8nDoorService } from "./n8n-door.service"
import { N8nEmailService } from "./n8n-email.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./n8n-runs.module-definition"
import { N8nRunsService } from "./n8n-runs.service"

@Module({})
/** The n8n runs capability: the runs of the shared workflows, the data they fetch and the emails they ask for. */
export class N8nRunsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), N8nQueueModule.register({})],
            providers: [...(base.providers ?? []), N8nRunsService, N8nDataService, N8nEmailService, N8nDoorService],
            exports: [N8nRunsService, N8nDataService, N8nEmailService, N8nDoorService],
        }
    }
}
