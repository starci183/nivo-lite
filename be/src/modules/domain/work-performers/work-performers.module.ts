import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { N8N_MAILER } from "@modules/domain/n8n-runs"
import { BookingChatChangesService } from "./booking-chat-changes.service"
import { BookingChatService } from "./booking-chat.service"
import { BookingPerformerService } from "./booking-performer.service"
import { BookingReminderTickService } from "./booking-reminder-tick.service"
import { BookingRemindPerformerService } from "./booking-remind-performer.service"
import { BookingToolsService } from "./booking-tools.service"
import { CarePerformerService } from "./care-performer.service"
import { GatewayCallPerformerService } from "./gateway-call-performer.service"
import { ClassifyLeadPerformerService } from "./classify-lead-performer.service"
import { ConfirmOrderPerformerService } from "./confirm-order-performer.service"
import { ConversationLeadsService } from "./conversation-leads.service"
import { HandoffToolService } from "./handoff-tool.service"
import { InboundStatusService } from "./inbound-status.service"
import { LeadWriterService } from "./lead-writer.service"
import { OutboundAccessService } from "./outbound-access.service"
import { CustomerDeliveryService } from "./customer-delivery.service"
import { FollowUpPerformerService } from "./follow-up-performer.service"
import { HandoffLeadPerformerService } from "./handoff-lead-performer.service"
import { IssueInvoicePerformerService } from "./issue-invoice-performer.service"
import { PaymentInstructionsService } from "./payment-instructions.service"
import { PerformerKitService } from "./performer-kit.service"
import { QuotePerformerService } from "./quote-performer.service"
import { RedeemRewardPerformerService } from "./redeem-reward-performer.service"
import { BankCreditSettlementService } from "./bank-credit-settlement.service"
import { ReconcilePaymentPerformerService } from "./reconcile-payment-performer.service"
import { ReplyCustomerPerformerService } from "./reply-customer-performer.service"
import { SendEmailPerformerService } from "./send-email-performer.service"
import { PROMPT_WRITER } from "./work-performers.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./work-performers.module-definition"
import { WorkPerformersRegistrarService } from "./work-performers-registrar.service"
import { WorkspaceMailerService } from "./workspace-mailer.service"

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
                BookingToolsService,
                { provide: PROMPT_WRITER, useExisting: options.writer },
                PerformerKitService,
                CustomerDeliveryService,
                PaymentInstructionsService,
                HandoffLeadPerformerService,
                ClassifyLeadPerformerService,
                FollowUpPerformerService,
                QuotePerformerService,
                CarePerformerService,
                GatewayCallPerformerService,
                ConfirmOrderPerformerService,
                IssueInvoicePerformerService,
                ReconcilePaymentPerformerService,
                BankCreditSettlementService,
                ReplyCustomerPerformerService,
                SendEmailPerformerService,
                BookingPerformerService,
                BookingRemindPerformerService,
                BookingReminderTickService,
                BookingChatService,
                BookingChatChangesService,
                RedeemRewardPerformerService,
                WorkPerformersRegistrarService,
                ConversationLeadsService,
                HandoffToolService,
                InboundStatusService,
                LeadWriterService,
                OutboundAccessService,
                WorkspaceMailerService,
                { provide: N8N_MAILER, useExisting: WorkspaceMailerService },
            ],
            exports: [
                BookingChatService,
                BookingToolsService,
                PerformerKitService,
                ConversationLeadsService,
                HandoffToolService,
                InboundStatusService,
                LeadWriterService,
                OutboundAccessService,
                BankCreditSettlementService,
                WorkspaceMailerService,
                N8N_MAILER,
            ],
        }
    }
}
