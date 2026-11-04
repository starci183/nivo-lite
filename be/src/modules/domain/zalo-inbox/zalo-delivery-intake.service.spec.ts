import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { PollScheduleService } from "@modules/domain/connection-poll"
import { ZaloDeliveryIntakeService } from "./zalo-delivery-intake.service"
import { ZaloInboxService } from "./zalo-inbox.service"

const BODY = Buffer.from('{"event_name":"user_send_text"}')

const build = async () => {
    const inbox = mock<ZaloInboxService>()
    inbox.acceptZaloDelivery.mockResolvedValue(undefined)
    const schedule = mock<PollScheduleService>()
    schedule.recordWebhook.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ZaloDeliveryIntakeService,
            { provide: ZaloInboxService, useValue: inbox },
            { provide: PollScheduleService, useValue: schedule },
        ],
    }).compile()
    return { service: moduleRef.get(ZaloDeliveryIntakeService), inbox, schedule }
}

describe("ZaloDeliveryIntakeService", () => {
    it("records the receipt first, then tells the poll schedule the webhook delivers", async () => {
        const { service, inbox, schedule } = await build()
        const order: Array<string> = []
        inbox.acceptZaloDelivery.mockImplementation(() => {
            order.push("receipt")
            return Promise.resolve(undefined)
        })
        schedule.recordWebhook.mockImplementation(() => {
            order.push("schedule")
            return Promise.resolve(undefined)
        })

        await service.accept(BODY, "c-1")

        expect(order).toEqual(["receipt", "schedule"])
        expect(inbox.acceptZaloDelivery).toHaveBeenCalledWith(BODY, "c-1")
        expect(schedule.recordWebhook).toHaveBeenCalledWith("c-1")
    })

    it("leaves the schedule untouched when the receipt fails", async () => {
        const { service, inbox, schedule } = await build()
        const failure = new Error("inbox unavailable")
        inbox.acceptZaloDelivery.mockRejectedValue(failure)

        await expect(service.accept(BODY, "c-1")).rejects.toBe(failure)

        expect(schedule.recordWebhook).not.toHaveBeenCalled()
    })
})
