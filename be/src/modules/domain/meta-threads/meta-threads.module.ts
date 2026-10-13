import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./meta-threads.module-definition"
import { MetaThreadsService } from "./meta-threads.service"

@Module({})
/** The 24 hour messaging windows of the Facebook and Instagram conversations. */
export class MetaThreadsModule extends ConfigurableModuleClass {
    /** Registers the capability under the capability that writes through it. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), MetaThreadsService], exports: [MetaThreadsService] }
    }
}
