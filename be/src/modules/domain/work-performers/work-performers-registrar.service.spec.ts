import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { WORK_PERFORMER_REGISTRY } from "@modules/domain/decisions"
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
import { WorkPerformersRegistrarService } from "./work-performers-registrar.service"

describe("WorkPerformersRegistrarService", () => {
    it("registers the ten performers at boot", async () => {
        const registry = mock<WorkPerformerRegistry>()
        const handoff = mock<HandoffLeadPerformerService>()
        const classify = mock<ClassifyLeadPerformerService>()
        const followUp = mock<FollowUpPerformerService>()
        const quote = mock<QuotePerformerService>()
        const care = mock<CarePerformerService>()
        const order = mock<ConfirmOrderPerformerService>()
        const invoice = mock<IssueInvoicePerformerService>()
        const payment = mock<ReconcilePaymentPerformerService>()
        const reply = mock<ReplyCustomerPerformerService>()
        const email = mock<SendEmailPerformerService>()
        const moduleRef = await Test.createTestingModule({
            providers: [
                WorkPerformersRegistrarService,
                { provide: WORK_PERFORMER_REGISTRY, useValue: registry },
                { provide: HandoffLeadPerformerService, useValue: handoff },
                { provide: ClassifyLeadPerformerService, useValue: classify },
                { provide: FollowUpPerformerService, useValue: followUp },
                { provide: QuotePerformerService, useValue: quote },
                { provide: CarePerformerService, useValue: care },
                { provide: ConfirmOrderPerformerService, useValue: order },
                { provide: IssueInvoicePerformerService, useValue: invoice },
                { provide: ReconcilePaymentPerformerService, useValue: payment },
                { provide: ReplyCustomerPerformerService, useValue: reply },
                { provide: SendEmailPerformerService, useValue: email },
            ],
        }).compile()

        expect(moduleRef.get(WorkPerformersRegistrarService).onModuleInit()).toBeUndefined()

        expect(registry.add).toHaveBeenNthCalledWith(1, "handoff_lead", handoff)
        expect(registry.add).toHaveBeenNthCalledWith(2, "classify_lead", classify)
        expect(registry.add).toHaveBeenNthCalledWith(3, "send_follow_up", followUp)
        expect(registry.add).toHaveBeenNthCalledWith(4, "send_quote", quote)
        expect(registry.add).toHaveBeenNthCalledWith(5, "send_care", care)
        expect(registry.add).toHaveBeenNthCalledWith(6, "confirm_order", order)
        expect(registry.add).toHaveBeenNthCalledWith(7, "issue_invoice", invoice)
        expect(registry.add).toHaveBeenNthCalledWith(8, "reconcile_payment", payment)
        expect(registry.add).toHaveBeenNthCalledWith(9, "reply_customer", reply)
        expect(registry.add).toHaveBeenNthCalledWith(10, "send_email", email)
    })
})
