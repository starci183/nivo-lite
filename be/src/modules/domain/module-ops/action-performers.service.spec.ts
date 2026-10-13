import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ActionPerformer } from "./action-performer.port"
import { ActionPerformersService } from "./action-performers.service"

const performerOf = (action: string): ActionPerformer => mock<ActionPerformer>({ action })

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [ActionPerformersService] }).compile()
    return moduleRef.get(ActionPerformersService)
}

describe("ActionPerformersService", () => {
    it("finds the performer registered for an action", async () => {
        const registry = await build()
        const performer = performerOf("send_purchase_order")

        registry.add(performer)

        expect(registry.performersOf("send_purchase_order")).toEqual([performer])
    })

    it("answers no performer for an action nobody registered", async () => {
        const registry = await build()

        expect(registry.performersOf("unknown_action")).toEqual([])
    })

    it("lets a second performer of the same action replace the first", async () => {
        const registry = await build()
        const first = performerOf("adjust_stock")
        const second = performerOf("adjust_stock")

        registry.add(first)
        registry.add(second)

        expect(registry.performersOf("adjust_stock")).toEqual([second])
    })
})
