import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ChannelProvisioningService } from "./channel-provisioning.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./channel-provisioning.module-definition"

@Module({})
/** The tool that connects a Telegram bot or a SePay feed to a workspace from the terminal. */
export class ChannelProvisioningModule extends ConfigurableModuleClass {
    /** Registers the tool once in the cli app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ChannelProvisioningService],
            exports: [ChannelProvisioningService],
        }
    }
}
