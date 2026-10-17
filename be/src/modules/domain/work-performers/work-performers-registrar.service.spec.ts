import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { WORK_PERFORMER_REGISTRY } from "@modules/domain/decisions"
import type { WorkPerformer, WorkPerformerRegistry } from "@modules/domain/decisions"
import { BookingPerformerService } from "./booking-performer.service"
import { BookingRemindPerformerService } from "./booking-remind-performer.service"
import { CarePerformerService } from "./care-performer.service"
import { ClassifyLeadPerformerService } from "./classify-lead-performer.service"
import { ConfirmOrderPerformerService } from "./confirm-order-performer.service"
import { FollowUpPerformerService } from "./follow-up-performer.service"
import { HandoffLeadPerformerService } from "./handoff-lead-performer.service"
import { IssueInvoicePerformerService } from "./issue-invoice-performer.service"
import { QuotePerformerService } from "./quote-performer.service"
import { RedeemRewardPerformerService } from "./redeem-reward-performer.service"
import { ReconcilePaymentPerformerService } from "./reconcile-payment-performer.service"
import { ReplyCustomerPerformerService } from "./reply-customer-performer.service"
import { SendEmailPerformerService } from "./send-email-performer.service"
import { WorkPerformersRegistrarService } from "./work-performers-registrar.service"

const build = async () => {
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
    const booking = mock<BookingPerformerService>()
    const remind = mock<BookingRemindPerformerService>()
    const redeem = mock<RedeemRewardPerformerService>()
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
            { provide: BookingPerformerService, useValue: booking },
            { provide: BookingRemindPerformerService, useValue: remind },
            { provide: RedeemRewardPerformerService, useValue: redeem },
        ],
    }).compile()

    return {
        moduleRef,
        registry,
        handoff,
        classify,
        followUp,
        quote,
        care,
        order,
        invoice,
        payment,
        reply,
        email,
        booking,
        remind,
        redeem,
    }
}

describe("WorkPerformersRegistrarService", () => {
    it("registers sales, booking, reminder and reward performers at boot", async () => {
        const {
            moduleRef,
            registry,
            handoff,
            classify,
            followUp,
            quote,
            care,
            order,
            invoice,
            payment,
            reply,
            email,
            booking,
            remind,
            redeem,
        } = await build()

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
            "cancel_booking",
            "cancel_with_fee",
            "confirm_booking",
            "reschedule",
            "remind_booking",
            "redeem_reward",
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
        expect(registered.get("cancel_booking")).toBe(booking)
        expect(registered.get("cancel_with_fee")).toBe(booking)
        expect(registered.get("confirm_booking")).toBe(booking)
        expect(registered.get("reschedule")).toBe(booking)
        expect(registered.get("remind_booking")).toBe(remind)
        expect(registered.get("redeem_reward")).toBe(redeem)
        expect(registry.add).toHaveBeenCalledTimes(16)
        expect(registry.add).toHaveBeenCalledWith("cancel_booking", booking)
        expect(registry.add).toHaveBeenCalledWith("cancel_with_fee", booking)
        expect(registry.add).toHaveBeenCalledWith("confirm_booking", booking)
        expect(registry.add).toHaveBeenCalledWith("reschedule", booking)
        expect(registry.add).toHaveBeenCalledWith("remind_booking", remind)
        expect(registry.add).toHaveBeenCalledWith("redeem_reward", redeem)
    })
})
