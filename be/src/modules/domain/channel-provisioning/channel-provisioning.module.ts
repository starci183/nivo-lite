import { Module, type DynamicModule } from "@nestjs/common"
import { BrainSeedService } from "./brain-seed.service"
import { ManagementSeedService } from "./management-seed.service"
import { EnterpriseSeedService } from "./enterprise-seed.service"
import { ChatSeedService } from "./chat-seed.service"
import { RecordsSeedService } from "./records-seed.service"
import { TestAccountsSeedService } from "./test-accounts-seed.service"
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
            providers: [
                ...(base.providers ?? []),
                ChannelProvisioningService,
                ManagementSeedService,
                TestAccountsSeedService,
                BrainSeedService,
                RecordsSeedService,
                ChatSeedService,
                EnterpriseSeedService,
            ],
            exports: [
                ChannelProvisioningService,
                ManagementSeedService,
                TestAccountsSeedService,
                BrainSeedService,
                RecordsSeedService,
                ChatSeedService,
                EnterpriseSeedService,
            ],
        }
    }
}
