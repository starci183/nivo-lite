import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { MetaInboxService } from "./meta-inbox.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./meta-inbox.module-definition"

@Module({})
/** The durable inbox of the signed Meta webhook deliveries. */
export class MetaInboxModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), MetaInboxService], exports: [MetaInboxService] }
    }
}
