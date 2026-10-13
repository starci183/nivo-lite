import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import type { WorkPerformer } from "./decisions.contracts"
import { WorkPerformersService } from "./work-performers.service"

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [WorkPerformersService] }).compile()
    return moduleRef.get(WorkPerformersService)
}

describe("WorkPerformersService", () => {
    it("answers the performer registered for an action", async () => {
        const service = await build()
        const performer = mock<WorkPerformer>()

        service.add("send_follow_up", performer)

        expect(service.performerOf("send_follow_up")).toBe(performer)
    })

    it("answers null for an action nobody registered", async () => {
        const service = await build()

        expect(service.performerOf("send_follow_up")).toBeNull()
    })

    it("lets a later registration replace the earlier one", async () => {
        const service = await build()
        const second = mock<WorkPerformer>()

        service.add("send_follow_up", mock<WorkPerformer>())
        service.add("send_follow_up", second)

        expect(service.performerOf("send_follow_up")).toBe(second)
    })
})
