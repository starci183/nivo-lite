import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./channel-receipts.module-definition"
import { ChannelReceiptsService } from "./channel-receipts.service"

@Module({})
/** The receipts channels keep to act at most once, over the primary Supabase PostgreSQL connection. */
export class ChannelReceiptsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ChannelReceiptsService],
            exports: [ChannelReceiptsService],
        }
    }
}
