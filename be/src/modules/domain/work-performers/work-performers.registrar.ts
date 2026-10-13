import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectWorkPerformerRegistry } from "@modules/domain/decisions"
import type { WorkPerformerRegistry } from "@modules/domain/decisions"
import { CarePerformer } from "./care.performer"
import { ClassifyLeadPerformer } from "./classify-lead.performer"
import { ConfirmOrderPerformer } from "./confirm-order.performer"
import { FollowUpPerformer } from "./follow-up.performer"
import { HandoffLeadPerformer } from "./handoff-lead.performer"
import { IssueInvoicePerformer } from "./issue-invoice.performer"
import { QuotePerformer } from "./quote.performer"
import { ReconcilePaymentPerformer } from "./reconcile-payment.performer"
import { ReplyCustomerPerformer } from "./reply-customer.performer"
import { SendEmailPerformer } from "./send-email.performer"

@Injectable()
/** Registers the performer of each action with the work engine at boot; an action without one only records its decision. */
export class WorkPerformersRegistrar implements OnModuleInit {
    constructor(
        @InjectWorkPerformerRegistry() private readonly registry: WorkPerformerRegistry,
        private readonly handoff: HandoffLeadPerformer,
        private readonly classify: ClassifyLeadPerformer,
        private readonly followUp: FollowUpPerformer,
        private readonly quote: QuotePerformer,
        private readonly care: CarePerformer,
        private readonly order: ConfirmOrderPerformer,
        private readonly invoice: IssueInvoicePerformer,
        private readonly payment: ReconcilePaymentPerformer,
        private readonly reply: ReplyCustomerPerformer,
        private readonly email: SendEmailPerformer,
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
