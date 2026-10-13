import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ChannelSetupClient } from "./channel-setup.client"
import { CHANNEL_SETUP_CLIENT } from "./channel-setup.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./channel-setup.module-definition"

@Module({})
/** Provides the channel-setup client. */
export class ChannelSetupModule extends ConfigurableModuleClass {
    /** Registers the integration once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: CHANNEL_SETUP_CLIENT, useClass: ChannelSetupClient }],
            exports: [CHANNEL_SETUP_CLIENT],
        }
    }
}
