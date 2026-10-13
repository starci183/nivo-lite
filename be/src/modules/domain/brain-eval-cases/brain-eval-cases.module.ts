import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./brain-eval-cases.module-definition"
import { BrainEvalCasesService } from "./brain-eval-cases.service"

@Module({})
/** The brain-eval-cases capability. */
export class BrainEvalCasesModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), BrainEvalCasesService],
            exports: [BrainEvalCasesService],
        }
    }
}
