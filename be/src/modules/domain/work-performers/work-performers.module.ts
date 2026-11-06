import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { BookingChatChangesService } from "./booking-chat-changes.service"
import { BookingChatService } from "./booking-chat.service"
import { BookingPerformerService } from "./booking-performer.service"
import { BookingRemindPerformerService } from "./booking-remind-performer.service"
import { BookingToolsService } from "./booking-tools.service"
import { GatewayCallPerformerService } from "./gateway-call-performer.service"
import { HandOverConversationPerformerService } from "./hand-over-conversation-performer.service"
import { ResumeRunPerformerService } from "./resume-run-performer.service"
import { ConversationLeadsService } from "./conversation-leads.service"
import { HandoffToolService } from "./handoff-tool.service"
import { InboundStatusService } from "./inbound-status.service"
import { LeadWriterService } from "./lead-writer.service"
import { OutboundAccessService } from "./outbound-access.service"
import { CustomerDeliveryService } from "./customer-delivery.service"
import { PerformerKitService } from "./performer-kit.service"
import { ReplyCustomerPerformerService } from "./reply-customer-performer.service"
import { SendEmailPerformerService } from "./send-email-performer.service"
import { PROMPT_WRITER, WORKSPACE_MAILER } from "./work-performers.decorators"
import { INBOX, InboxService } from "@modules/platform/inbox"
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
                { provide: INBOX, useClass: InboxService },
                BookingToolsService,
                { provide: PROMPT_WRITER, useExisting: options.writer },
                PerformerKitService,
                CustomerDeliveryService,
                GatewayCallPerformerService,
                HandOverConversationPerformerService,
                ResumeRunPerformerService,
                ReplyCustomerPerformerService,
                SendEmailPerformerService,
                BookingPerformerService,
                BookingRemindPerformerService,
                BookingChatService,
                BookingChatChangesService,
                WorkPerformersRegistrarService,
                ConversationLeadsService,
                HandoffToolService,
                InboundStatusService,
                LeadWriterService,
                OutboundAccessService,
                WorkspaceMailerService,
                { provide: WORKSPACE_MAILER, useExisting: WorkspaceMailerService },
            ],
            exports: [
                CustomerDeliveryService,
                BookingChatService,
                BookingToolsService,
                PerformerKitService,
                ConversationLeadsService,
                HandoffToolService,
                InboundStatusService,
                LeadWriterService,
                OutboundAccessService,
                WorkspaceMailerService,
                WORKSPACE_MAILER,
            ],
        }
    }
}
