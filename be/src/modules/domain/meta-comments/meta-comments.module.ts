import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./meta-comments.module-definition"
import { MetaCommentsService } from "./meta-comments.service"

@Module({})
/** The comments and mentions the Pages received, kept for their private-reply window. */
export class MetaCommentsModule extends ConfigurableModuleClass {
    /** Registers the capability under the capability that writes through it. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), MetaCommentsService], exports: [MetaCommentsService] }
    }
}
