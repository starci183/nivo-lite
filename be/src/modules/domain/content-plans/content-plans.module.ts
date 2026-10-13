import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ContentPlansService } from "./content-plans.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./content-plans.module-definition"

@Module({})
/** Editorial month plans. */
export class ContentPlansModule extends ConfigurableModuleClass {
    /** Registers the table owner once. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), ContentPlansService], exports: [ContentPlansService] }
    }
}
