import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { MetaCommentsModule } from "@modules/domain/meta-comments"
import { MetaThreadsModule } from "@modules/domain/meta-threads"
import { MetaInboxService } from "./meta-inbox.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./meta-inbox.module-definition"

@Module({})
/** The durable inbox of the signed Meta webhook deliveries. */
export class MetaInboxModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), MetaThreadsModule.register({}), MetaCommentsModule.register({})],
            providers: [...(base.providers ?? []), MetaInboxService],
            exports: [MetaInboxService],
        }
    }
}
