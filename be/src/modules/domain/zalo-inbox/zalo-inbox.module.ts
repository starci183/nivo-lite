import { ZaloDeliveryPolicy } from "./zalo-delivery.policy"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./zalo-inbox.module-definition"
import { ZaloInboxPageReadService } from "./zalo-inbox-page-read.service"
import { ZaloInboxService } from "./zalo-inbox.service"
import { ZaloInboxPoller } from "./zalo-inbox-poller.service"
import { ZaloInboxPollService } from "./zalo-poll.service"
import { ZaloInboxPollTriggerService } from "./zalo-poll-trigger.service"

@Module({})
/** The durable inbox of the zalo-inbox webhook, over the primary PostgreSQL connection. */
export class ZaloInboxModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: INBOX, useClass: InboxService },
                ZaloInboxService,
                ZaloInboxPoller,
                ZaloInboxPollService,
                ZaloInboxPollTriggerService,
                ZaloInboxPageReadService,
                ZaloDeliveryPolicy,
            ],
            exports: [ZaloInboxService, ZaloInboxPollService, ZaloInboxPollTriggerService, ZaloInboxPageReadService, ZaloDeliveryPolicy],
        }
    }
}
