import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ChannelConnectionsService } from "./channel-connections.service"
import { WorkspacePaymentAccountService } from "./workspace-payment-account.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./channel-connections.module-definition"

@Module({})
/** The Telegram, bank-feed and Zalo connection wizards over the connections capability, and the workspace payment account read. */
export class ChannelConnectionsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ChannelConnectionsService, WorkspacePaymentAccountService],
            exports: [ChannelConnectionsService, WorkspacePaymentAccountService],
        }
    }
}
