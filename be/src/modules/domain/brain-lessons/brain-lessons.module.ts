import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./brain-lessons.module-definition"
import { BrainLessonsService } from "./brain-lessons.service"

@Module({})
/** The brain-lessons capability. */
export class BrainLessonsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), BrainLessonsService], exports: [BrainLessonsService] }
    }
}
