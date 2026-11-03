import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { PollScheduleService, PollSourceRegistry } from "@modules/domain/connection-poll"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import type { ConnectionStatusFacts } from "@modules/domain/connections"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { OrdersLogEvent } from "./orders.log-events"
import { PaymentDemandService } from "./payment-demand.service"

const connection = (id: string): ConnectionStatusFacts => ({ id }) as ConnectionStatusFacts

const build = async () => {
    const logger = mock<Logger>()
    const sources = mock<PollSourceRegistry>()
    sources.providers.mockReturnValue(["bank-a", "bank-b"])
    const schedule = mock<PollScheduleService>()
    const bindings = mock<ConnectionBindingsReadService>()
    bindings.ofProvider.mockImplementation((_workspaceId, provider) =>
        Promise.resolve(provider === "bank-a" ? [connection("c1"), connection("c2")] : [connection("c3")]),
    )
    const moduleRef = await Test.createTestingModule({
        providers: [
            PaymentDemandService,
            { provide: LOGGER, useValue: logger },
            { provide: PollSourceRegistry, useValue: sources },
            { provide: PollScheduleService, useValue: schedule },
            { provide: ConnectionBindingsReadService, useValue: bindings },
        ],
    }).compile()
    return { demand: moduleRef.get(PaymentDemandService), logger, schedule, bindings }
}

describe("PaymentDemandService", () => {
    it("polls every connection of every pollable provider fast for two hours when an order awaits money", async () => {
        const { demand, schedule, bindings } = await build()

        await demand.orderAwaitingPayment("ws-1")

        expect(bindings.ofProvider).toHaveBeenCalledWith("ws-1", "bank-a", 20)
        expect(bindings.ofProvider).toHaveBeenCalledWith("ws-1", "bank-b", 20)
        expect(schedule.markHot.mock.calls).toEqual([
            ["c1", "order_awaiting_payment", 7_200_000],
            ["c2", "order_awaiting_payment", 7_200_000],
            ["c3", "order_awaiting_payment", 7_200_000],
        ])
    })

    it("polls them fast for half an hour when a customer says they paid", async () => {
        const { demand, schedule } = await build()

        await demand.claimOpen("ws-1")

        expect(schedule.markHot).toHaveBeenCalledWith("c1", "payment_claim_open", 1_800_000)
        expect(schedule.markHot).toHaveBeenCalledTimes(3)
    })

    it("never fails the order or the claim when the scheduler cannot be told", async () => {
        const { demand, schedule, logger } = await build()
        const failure = new Error("redis down")
        schedule.markHot.mockRejectedValue(failure)

        await expect(demand.claimOpen("ws-1")).resolves.toBeUndefined()

        expect(logger.error).toHaveBeenCalledWith(OrdersLogEvent.PaymentDemandFailed, failure, {
            workspaceId: "ws-1",
            reason: "payment_claim_open",
        })
    })
})
