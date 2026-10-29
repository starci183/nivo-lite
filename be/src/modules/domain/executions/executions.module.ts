import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./executions.module-definition"
import { ExecutionsService } from "./executions.service"
import { ExecutionsFiguresService } from "./executions-figures.service"

@Module({})
/** The approval cards of a workspace over the primary Supabase PostgreSQL connection. */
export class ExecutionsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ExecutionsService, ExecutionsFiguresService],
            exports: [ExecutionsService, ExecutionsFiguresService],
        }
    }
}
