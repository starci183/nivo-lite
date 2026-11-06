import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { WORK_PERFORMER_REGISTRY } from "@modules/domain/decisions"
import type { WorkPerformer, WorkPerformerRegistry } from "@modules/domain/decisions"
import { BookingPerformerService } from "./booking-performer.service"
import { BookingRemindPerformerService } from "./booking-remind-performer.service"
import { GatewayCallPerformerService } from "./gateway-call-performer.service"
import { HandOverConversationPerformerService } from "./hand-over-conversation-performer.service"
import { ReplyCustomerPerformerService } from "./reply-customer-performer.service"
import { ResumeRunPerformerService } from "./resume-run-performer.service"
import { SendEmailPerformerService } from "./send-email-performer.service"
import { WorkPerformersRegistrarService } from "./work-performers-registrar.service"

const build = async () => {
    const registry = mock<WorkPerformerRegistry>()
    const reply = mock<ReplyCustomerPerformerService>()
    const email = mock<SendEmailPerformerService>()
    const booking = mock<BookingPerformerService>()
    const remind = mock<BookingRemindPerformerService>()
    const gatewayCall = mock<GatewayCallPerformerService>()
    const handOver = mock<HandOverConversationPerformerService>()
    const resumeRun = mock<ResumeRunPerformerService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkPerformersRegistrarService,
            { provide: WORK_PERFORMER_REGISTRY, useValue: registry },
            { provide: ReplyCustomerPerformerService, useValue: reply },
            { provide: SendEmailPerformerService, useValue: email },
            { provide: BookingPerformerService, useValue: booking },
            { provide: BookingRemindPerformerService, useValue: remind },
            { provide: GatewayCallPerformerService, useValue: gatewayCall },
            { provide: HandOverConversationPerformerService, useValue: handOver },
            { provide: ResumeRunPerformerService, useValue: resumeRun },
        ],
    }).compile()

    return { moduleRef, registry, reply, email, booking, remind, gatewayCall, handOver, resumeRun }
}

describe("WorkPerformersRegistrarService", () => {
    it("registers the reply, email, booking, reminder, gateway call, hand-over and run review performers at boot", async () => {
        const { moduleRef, registry, reply, email, booking, remind, gatewayCall, handOver, resumeRun } = await build()

        const registered = new Map<string, WorkPerformer>()
        registry.add.mockImplementation((action, performer) => {
            registered.set(action, performer)
        })

        moduleRef.get(WorkPerformersRegistrarService).onModuleInit()

        expect([...registered.keys()]).toEqual([
            "reply_customer",
            "send_email",
            "cancel_booking",
            "cancel_with_fee",
            "confirm_booking",
            "reschedule",
            "remind_booking",
            "gateway_call",
            "hand_over_conversation",
            "review_agent_run",
        ])
        expect(registered.get("gateway_call")).toBe(gatewayCall)
        expect(registered.get("hand_over_conversation")).toBe(handOver)
        expect(registered.get("review_agent_run")).toBe(resumeRun)
        expect(registered.get("reply_customer")).toBe(reply)
        expect(registered.get("send_email")).toBe(email)
        expect(registered.get("cancel_booking")).toBe(booking)
        expect(registered.get("cancel_with_fee")).toBe(booking)
        expect(registered.get("confirm_booking")).toBe(booking)
        expect(registered.get("reschedule")).toBe(booking)
        expect(registered.get("remind_booking")).toBe(remind)
        expect(registry.add).toHaveBeenCalledTimes(10)
    })
})
