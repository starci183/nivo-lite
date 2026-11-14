import { Module, type DynamicModule } from "@nestjs/common"
import { SepayBankTransactionsService } from "./sepay-bank-transactions.service"
import { SepayFeedWebhookService } from "./sepay-feed-webhook.service"
import { SepayFeedPollerService } from "./sepay-feed-poller.service"
import { SepayPaymentInstructionService } from "./sepay-payment-instruction.service"
import { SepaySandboxBankTransactionsService } from "./sepay-sandbox-bank-transactions.service"
import { SepaySandboxFeedPollerService } from "./sepay-sandbox-feed-poller.service"
import { SepaySandboxPaymentInstructionService } from "./sepay-sandbox-payment-instruction.service"
import { SepayProviderRegistrationService } from "./sepay-provider-registration.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./sepay-provider.module-definition"

const SANDBOXES = [SepaySandboxFeedPollerService, SepaySandboxBankTransactionsService, SepaySandboxPaymentInstructionService]
const PROVIDERS = [SepayFeedPollerService, SepayBankTransactionsService, SepayPaymentInstructionService]

@Module({})
/**
 * Everything SePay-specific that core asks a provider for, registered under the capability names: the poller that reads its
 * transactions back, the transaction list its MCP tool (`nivo.tool.bank.transaction.list`) answers with, the payment instruction the QR effect draws,
 * and, in the app that receives it, the workspace-feed webhook.
 */
export class SepayProviderModule extends ConfigurableModuleClass {
    /** Registers the app's SePay provider once. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const providers = options.feedWebhook === true ? [...PROVIDERS, SepayFeedWebhookService] : PROVIDERS
        return {
            ...base,
            providers: [...(base.providers ?? []), ...providers, ...SANDBOXES, SepayProviderRegistrationService],
            exports: providers,
        }
    }
}
