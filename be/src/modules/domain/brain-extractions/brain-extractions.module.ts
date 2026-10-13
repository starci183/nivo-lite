import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./brain-extractions.module-definition"
import { BrainExtractionsService } from "./brain-extractions.service"

@Module({})
/** The brain-extractions capability. */
export class BrainExtractionsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), BrainExtractionsService], exports: [BrainExtractionsService] }
    }
}
