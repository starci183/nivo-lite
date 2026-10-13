import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectWorkPerformerRegistry } from "@modules/domain/decisions"
import type { WorkPerformerRegistry } from "@modules/domain/decisions"
import { CarePerformerService } from "./care-performer.service"
import { ClassifyLeadPerformerService } from "./classify-lead-performer.service"
import { ConfirmOrderPerformerService } from "./confirm-order-performer.service"
import { FollowUpPerformerService } from "./follow-up-performer.service"
import { HandoffLeadPerformerService } from "./handoff-lead-performer.service"
import { IssueInvoicePerformerService } from "./issue-invoice-performer.service"
import { QuotePerformerService } from "./quote-performer.service"
import { ReconcilePaymentPerformerService } from "./reconcile-payment-performer.service"
import { ReplyCustomerPerformerService } from "./reply-customer-performer.service"
import { SendEmailPerformerService } from "./send-email-performer.service"

@Injectable()
/** Registers the performer of each action with the work engine at boot; an action without one only records its decision. */
export class WorkPerformersRegistrarService implements OnModuleInit {
    constructor(
        @InjectWorkPerformerRegistry() private readonly registry: WorkPerformerRegistry,
        private readonly handoff: HandoffLeadPerformerService,
        private readonly classify: ClassifyLeadPerformerService,
        private readonly followUp: FollowUpPerformerService,
        private readonly quote: QuotePerformerService,
        private readonly care: CarePerformerService,
        private readonly order: ConfirmOrderPerformerService,
        private readonly invoice: IssueInvoicePerformerService,
        private readonly payment: ReconcilePaymentPerformerService,
        private readonly reply: ReplyCustomerPerformerService,
        private readonly email: SendEmailPerformerService,
    ) {}

    /** Adds the ten performers to the registry. */
    onModuleInit(): void {
        this.registry.add("handoff_lead", this.handoff)
        this.registry.add("classify_lead", this.classify)
        this.registry.add("send_follow_up", this.followUp)
        this.registry.add("send_quote", this.quote)
        this.registry.add("send_care", this.care)
        this.registry.add("confirm_order", this.order)
        this.registry.add("issue_invoice", this.invoice)
        this.registry.add("reconcile_payment", this.payment)
        this.registry.add("reply_customer", this.reply)
        this.registry.add("send_email", this.email)
    }
}
