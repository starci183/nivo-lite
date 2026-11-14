import { ZaloDeliveryPolicy } from "./zalo-delivery.policy"
import { Module, type DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./zalo-inbox.module-definition"
import { ZaloInboxPageReadService } from "./zalo-inbox-page-read.service"
import { ZaloInboxService } from "./zalo-inbox.service"
import { ZaloDeliveryIntakeService } from "./zalo-delivery-intake.service"
import { MessageInboxPollSourcesService } from "./message-inbox-poll-sources.service"
import { ZaloInboxTokensService } from "./zalo-inbox-tokens.service"
import { ZaloInboxPollTriggerService } from "./zalo-poll-trigger.service"
import { ZaloInboxPollService } from "./zalo-poll.service"
import { ZaloPolledInboxService } from "./zalo-polled-inbox.service"
import { ZaloReconcileService } from "./zalo-reconcile.service"

@Module({})
/**
 * The Zalo OA webhook and poll doors and their deferred consumer, keeping every event in the connection's account data; the poll walks the
 * provider's reader (its poll face) and keeps what it read under the webhook's key; the token port the provider reads with is bound here.
 */
export class ZaloInboxModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                ZaloInboxService,
                ZaloDeliveryIntakeService,
                ZaloInboxPageReadService,
                ZaloDeliveryPolicy,
                ZaloInboxTokensService,
                ZaloPolledInboxService,
                ZaloInboxPollService,
                ZaloInboxPollTriggerService,
                MessageInboxPollSourcesService,
                ZaloReconcileService,
            ],
            exports: [
                ZaloInboxService,
                ZaloDeliveryIntakeService,
                ZaloInboxPageReadService,
                ZaloDeliveryPolicy,
                ZaloInboxTokensService,
                ZaloInboxPollTriggerService,
                ZaloReconcileService,
            ],
        }
    }
}
