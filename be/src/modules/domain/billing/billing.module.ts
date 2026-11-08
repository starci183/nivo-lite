import { BankFeedDeliveryService } from "./bank-feed-delivery.service"
import { Module, type DynamicModule } from "@nestjs/common"
import { BankFeedFlowService } from "./bank-feed-flow.service"
import { BankFeedIntakeService } from "./bank-feed-intake.service"
import { BankFeedPollSourcesService } from "./bank-feed-poll-sources.service"
import { BankFeedPollService } from "./bank-feed-poll.service"
import { BankFeedPollTriggerService } from "./bank-feed-poll-trigger.service"
import { BankFeedReceiptsService } from "./bank-feed-receipts.service"
import { BankFeedService } from "./bank-feed.service"
import { BillingReadService } from "./billing-read.service"
import { BillingService } from "./billing.service"
import { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } from "./billing.module-definition"
import { PaymentSecretsService } from "./payment-secrets.service"
import { EntitlementsService } from "./entitlements.service"
import { PaymentProofService } from "./payment-proof.service"
import { CassoProofService } from "./casso-proof.service"
import { PayosProofService } from "./payos-proof.service"
import { BillingEventsReadService } from "./billing-events-read.service"
@Module({})
/** The billing capability over the primary PostgreSQL connection: plans, payment orders, SePay settlement and the payment feeds. */
export class BillingModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                BillingEventsReadService,
                BillingService,
                BillingReadService,
                EntitlementsService,
                PaymentProofService,
                CassoProofService,
                PayosProofService,
                PaymentSecretsService,
                BankFeedService,
                BankFeedReceiptsService,
                BankFeedFlowService,
                BankFeedIntakeService,
                BankFeedDeliveryService,
                BankFeedPollService,
                BankFeedPollTriggerService,
                BankFeedPollSourcesService,
            ],
            exports: [
                BillingEventsReadService,
                MODULE_OPTIONS_TOKEN,
                BillingService,
                BillingReadService,
                EntitlementsService,
                PaymentProofService,
                BankFeedService,
                BankFeedReceiptsService,
                BankFeedIntakeService,
                BankFeedDeliveryService,
                BankFeedPollService,
                BankFeedPollTriggerService,
            ],
        }
    }
}
