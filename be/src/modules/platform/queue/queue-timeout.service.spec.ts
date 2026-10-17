import { Test } from "@nestjs/testing"
import { QueueTimeoutService } from "./queue-timeout.service"

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [QueueTimeoutService] }).compile()
    return moduleRef.get(QueueTimeoutService)
}

describe("QueueTimeoutService", () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => {
        jest.clearAllTimers()
        jest.useRealTimers()
    })

    it("runs the callback once at the requested deadline", async () => {
        const timer = await build()
        const deliveries: Array<string> = []
        const callback = () => {
            deliveries.push("fired")
        }
        timer.schedule(callback, 100)

        jest.advanceTimersByTime(99)
        expect(deliveries).toEqual([])
        jest.advanceTimersByTime(1)
        expect(deliveries).toEqual(["fired"])
        jest.advanceTimersByTime(100)
        expect(deliveries).toEqual(["fired"])
    })

    it("cancels a pending callback", async () => {
        const timer = await build()
        const deliveries: Array<string> = []
        const callback = () => {
            deliveries.push("fired")
        }
        const cancel = timer.schedule(callback, 100)

        cancel()
        jest.advanceTimersByTime(100)
        expect(deliveries).toEqual([])
    })
})
