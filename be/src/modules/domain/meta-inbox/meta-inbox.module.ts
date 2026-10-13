import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { MetaCommentsModule } from "@modules/domain/meta-comments"
import { MetaThreadsModule } from "@modules/domain/meta-threads"
import { META_EVENT_TAKER } from "./meta-inbox.decorators"
import { MetaInboxService } from "./meta-inbox.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./meta-inbox.module-definition"

@Module({})
/** The durable inbox of the signed Meta webhook deliveries; it shares the messaging windows and the comments it records. */
export class MetaInboxModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const owners = [MetaThreadsModule.register({}), MetaCommentsModule.register({})]
        return {
            ...base,
            imports: [...(base.imports ?? []), ...owners],
            providers: [
                ...(base.providers ?? []),
                { provide: META_EVENT_TAKER, useExisting: options.taker },
                MetaInboxService,
            ],
            exports: [...owners, MetaInboxService],
        }
    }
}
