import { Module, Optional } from "@nestjs/common"
import type { DynamicModule, OnModuleInit } from "@nestjs/common"
import {
    BankFeedPollerRegistry,
    BankTransactionsRegistry,
    FeedWebhookRegistry,
    PaymentInstructionRegistry,
} from "@modules/domain/provider-registry"
import { SepayBankTransactionsService } from "./sepay-bank-transactions.service"
import { SepayFeedWebhookService } from "./sepay-feed-webhook.service"
import { SepayFeedPoller } from "./sepay-feed-poller.service"
import { SepayPaymentInstructionService } from "./sepay-payment-instruction.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./sepay-provider.module-definition"

const PROVIDERS = [SepayFeedPoller, SepayBankTransactionsService, SepayPaymentInstructionService]

@Module({})
/**
 * Everything SePay-specific that core asks a provider for, registered under the capability names: the poller that reads its
 * transactions back, the transaction list and the payment instruction its MCP tools (`bank.transactions`, `payment.instruction`) answer with,
 * and, in the app that receives it, the workspace-feed webhook.
 */
export class SepayProviderModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        private readonly pollers: BankFeedPollerRegistry,
        private readonly transactions: BankTransactionsRegistry,
        private readonly instructions: PaymentInstructionRegistry,
        private readonly webhooks: FeedWebhookRegistry,
        private readonly poller: SepayFeedPoller,
        private readonly lister: SepayBankTransactionsService,
        private readonly instruction: SepayPaymentInstructionService,
        @Optional() private readonly webhook?: SepayFeedWebhookService,
    ) {
        super()
    }

    /** Registers the app's SePay provider once. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const providers = options.feedWebhook === true ? [...PROVIDERS, SepayFeedWebhookService] : PROVIDERS
        return { ...base, providers: [...(base.providers ?? []), ...providers], exports: providers }
    }

    /** Hands each capability to its registry. */
    onModuleInit(): void {
        this.pollers.register(this.poller)
        this.transactions.register(this.lister)
        this.instructions.register(this.instruction)
        if (this.webhook !== undefined) this.webhooks.register(this.webhook)
    }
}
