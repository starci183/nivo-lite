import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AutomationCareExecutorsService } from "./automation-care-executors.service"
import { AutomationEngineService } from "./automation-engine.service"
import { AutomationExtensionsService } from "./automation-extensions.service"
import { AutomationMessagesService } from "./automation-messages.service"
import { AutomationReactionsService } from "./automation-reactions.service"
import { AutomationReactorsService } from "./automation-reactors.service"
import { AutomationOperationsExecutorsService } from "./automation-operations-executors.service"
import { AutomationRenewalPaymentService } from "./automation-renewal-payment.service"
import { AutomationScansService } from "./automation-scans.service"
import { AutomationShopService } from "./automation-shop.service"
import { InboxService, INBOX } from "@modules/platform/inbox"
import { DealWonConsumer } from "./reactors/deal-won.consumer"
import { DecisionMadeConsumer } from "./reactors/decision-made.consumer"
import { LeadCapturedConsumer } from "./reactors/lead-captured.consumer"
import { OrderConfirmedConsumer } from "./reactors/order-confirmed.consumer"
import { OrderShippedConsumer } from "./reactors/order-shipped.consumer"
import { PaymentReceiptConsumer } from "./reactors/payment-receipt.consumer"
import { PaymentReconciledConsumer } from "./reactors/payment-reconciled.consumer"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./automations.module-definition"
import { AutomationsService } from "./automations.service"
import { AutomationTickService } from "./automation-tick.service"

@Module({})
/**
 * The automations capability over the primary Supabase PostgreSQL connection: the gallery and its pipelines, the run history and the
 * engine that runs them. Other capabilities plug executors, scans and ticks in through `AutomationExtensions`.
 */
export class AutomationsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: INBOX, useClass: InboxService },
                AutomationShopService,
                AutomationScansService,
                AutomationExtensionsService,
                AutomationMessagesService,
                AutomationCareExecutorsService,
                AutomationRenewalPaymentService,
                AutomationOperationsExecutorsService,
                AutomationEngineService,
                AutomationsService,
                AutomationTickService,
                AutomationReactionsService,
                AutomationReactorsService,
                LeadCapturedConsumer,
                DealWonConsumer,
                DecisionMadeConsumer,
                PaymentReconciledConsumer,
                PaymentReceiptConsumer,
                OrderConfirmedConsumer,
                OrderShippedConsumer,
            ],
            exports: [AutomationsService, AutomationEngineService, AutomationExtensionsService, AutomationTickService],
        }
    }
}
