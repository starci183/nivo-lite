import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { WORK_PERFORMER_REGISTRY } from "@modules/domain/decisions"
import type { WorkPerformer, WorkPerformerRegistry } from "@modules/domain/decisions"
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

        const registered = new Map<string, WorkPerformer>()
        registry.add.mockImplementation((action, performer) => {
            registered.set(action, performer)
        })

        moduleRef.get(WorkPerformersRegistrarService).onModuleInit()

        expect([...registered.keys()]).toEqual([
            "handoff_lead",
            "classify_lead",
            "send_follow_up",
            "send_quote",
            "send_care",
            "confirm_order",
            "issue_invoice",
            "reconcile_payment",
            "reply_customer",
            "send_email",
        ])
        expect(registered.get("handoff_lead")).toBe(handoff)
        expect(registered.get("classify_lead")).toBe(classify)
        expect(registered.get("send_follow_up")).toBe(followUp)
        expect(registered.get("send_quote")).toBe(quote)
        expect(registered.get("send_care")).toBe(care)
        expect(registered.get("confirm_order")).toBe(order)
        expect(registered.get("issue_invoice")).toBe(invoice)
        expect(registered.get("reconcile_payment")).toBe(payment)
        expect(registered.get("reply_customer")).toBe(reply)
        expect(registered.get("send_email")).toBe(email)
    })
})
