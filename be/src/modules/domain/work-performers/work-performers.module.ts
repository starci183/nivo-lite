import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { CarePerformer } from "./care.performer"
import { ClassifyLeadPerformer } from "./classify-lead.performer"
import { ConfirmOrderPerformer } from "./confirm-order.performer"
import { ConversationLeadsService } from "./conversation-leads.service"
import { HandoffToolService } from "./handoff-tool.service"
import { InboundStatusService } from "./inbound-status.service"
import { LeadWriterService } from "./lead-writer.service"
import { OutboundAccessService } from "./outbound-access.service"
import { CustomerDeliveryService } from "./customer-delivery.service"
import { FollowUpPerformer } from "./follow-up.performer"
import { HandoffLeadPerformer } from "./handoff-lead.performer"
import { IssueInvoicePerformer } from "./issue-invoice.performer"
import { PaymentInstructionsService } from "./payment-instructions.service"
import { PerformerKitService } from "./performer-kit.service"
import { QuotePerformer } from "./quote.performer"
import { ReconcilePaymentPerformer } from "./reconcile-payment.performer"
import { ReplyCustomerPerformer } from "./reply-customer.performer"
import { SendEmailPerformer } from "./send-email.performer"
import { PROMPT_WRITER } from "./work-performers.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./work-performers.module-definition"
import { WorkPerformersRegistrar } from "./work-performers.registrar"

@Module({})
/**
 * The performers of the work engine: the work each action does once the gate or a person allowed it. They compose the capabilities that
 * own the records (leads, orders, invoices, transactions, conversations, email) and register themselves with the engine at boot.
 */
export class WorkPerformersModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app, after the decisions capability. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: PROMPT_WRITER, useExisting: options.writer },
                PerformerKitService,
                CustomerDeliveryService,
                PaymentInstructionsService,
                HandoffLeadPerformer,
                ClassifyLeadPerformer,
                FollowUpPerformer,
                QuotePerformer,
                CarePerformer,
                ConfirmOrderPerformer,
                IssueInvoicePerformer,
                ReconcilePaymentPerformer,
                ReplyCustomerPerformer,
                SendEmailPerformer,
                WorkPerformersRegistrar,
                ConversationLeadsService,
                HandoffToolService,
                InboundStatusService,
                LeadWriterService,
                OutboundAccessService,
            ],
            exports: [
                PerformerKitService,
                ConversationLeadsService,
                HandoffToolService,
                InboundStatusService,
                LeadWriterService,
                OutboundAccessService,
            ],
        }
    }
}
