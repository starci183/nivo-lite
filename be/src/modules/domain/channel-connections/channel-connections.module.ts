import { Module, type DynamicModule } from "@nestjs/common"
import { ChannelSeedService } from "./channel-seed.service"
import { ChannelConnectionsService } from "./channel-connections.service"
import { MoneyConnectionFieldsService } from "./money-connection-fields.service"
import { SepayConnectionService } from "./sepay-connection.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./channel-connections.module-definition"

@Module({})
/** The Telegram, bank-feed and Zalo connection wizards over the connections capability. */
export class ChannelConnectionsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                ChannelConnectionsService,
                ChannelSeedService,
                SepayConnectionService,
                MoneyConnectionFieldsService,
            ],
            exports: [
                ChannelConnectionsService,
                ChannelSeedService,
                SepayConnectionService,
                MoneyConnectionFieldsService,
            ],
        }
    }
}
