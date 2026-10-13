import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./responsibilities.module-definition"
import { ResponsibilitiesService } from "./responsibilities.service"

@Module({})
/** The steps of a lead journey, owned by a person or an agent, over the primary Supabase PostgreSQL connection. */
export class ResponsibilitiesModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ResponsibilitiesService],
            exports: [ResponsibilitiesService],
        }
    }
}
