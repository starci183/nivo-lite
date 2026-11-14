import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { AccountDataIntakeService } from "@modules/domain/account-data"
import type { PendingRow } from "@modules/domain/account-data"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BankFeedReceiptService } from "./bank-feed-inbox.service"
import type { FeedReceiptPayload } from "./bank-feed-inbox.contracts"
import { BankFeedInboxLogEvent } from "./bank-feed-inbox.log-events"

const CONNECTION = "0b8e6f4a-6c1e-4d47-9a51-1f3c2b7d9e10"
const DELIVERY = `${CONNECTION}:sepay:42`
const owner = { provider: "sepay", connectionId: CONNECTION, workspaceId: "ws-1" }
const credit = { amount: 1000, content: "payment", eventId: "sepay:42", fallbackBankName: "Bank" }
const payload: FeedReceiptPayload = { connection: CONNECTION, credits: [credit] }
const row: PendingRow = {
    id: "row-1",
    type: "sepay.delivery",
    key: "sepay:42",
    owner,
    value: { deliveryId: "sepay:42", credits: [credit] },
}
const written = (isNew: boolean, type = "sepay.delivery") => ({
    owner,
    rows: [{ type, key: "sepay:42", id: "row-1", isNew }],
})

const build = async () => {
    const manager = mockEntityManager()
    const intake = mock<AccountDataIntakeService>()
    intake.write.mockResolvedValue(written(true))
    intake.lockPending.mockResolvedValue(null)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            BankFeedReceiptService,
            { provide: AccountDataIntakeService, useValue: intake },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(BankFeedReceiptService), intake, logger, manager }
}

describe("BankFeedReceiptService claim", () => {
    it.each([
        ["sepay-feed", "sepay.delivery"],
        ["casso", "casso.delivery"],
        ["payos", "payos.delivery"],
    ] as const)("writes the first %s receipt as a %s row of the account", async (door, type) => {
        const { service, intake, manager } = await build()
        intake.write.mockResolvedValue(written(true, type))
        await expect(service.claim(manager, door, DELIVERY, { ...payload, source: "poll" })).resolves.toBe(true)
        expect(intake.write).toHaveBeenCalledWith(manager, CONNECTION, [
            { type, value: { deliveryId: "sepay:42", credits: [credit], source: "poll" } },
        ])
    })

    it("writes nothing new for a redelivery", async () => {
        const { service, intake, manager } = await build()
        intake.write.mockResolvedValue(written(false))
        await expect(service.claim(manager, "sepay-feed", DELIVERY, payload)).resolves.toBe(false)
    })

    it("keeps nothing and logs a connection nobody holds", async () => {
        const { service, intake, logger, manager } = await build()
        intake.write.mockResolvedValue({ owner: null, rows: [] })
        await expect(service.claim(manager, "casso", DELIVERY, payload)).resolves.toBe(false)
        expect(logger.warn).toHaveBeenCalledWith(BankFeedInboxLogEvent.UnknownConnection, {
            provider: "casso",
            connection: CONNECTION,
        })
    })

    it("keeps nothing for a delivery id with no connection", async () => {
        const { service, intake, logger, manager } = await build()
        await expect(service.claim(manager, "payos", "delivery-1", payload)).resolves.toBe(false)
        expect(intake.write).not.toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalledTimes(1)
    })

    it("propagates a refused write to the transaction owner", async () => {
        const { service, intake, manager } = await build()
        const failure = new Error("write failed")
        intake.write.mockRejectedValue(failure)
        await expect(service.claim(manager, "payos", DELIVERY, payload)).rejects.toBe(failure)
    })
})

describe("BankFeedReceiptService lock and complete", () => {
    it("locks the account's pending delivery and answers it in the consumer's shape", async () => {
        const { service, intake, manager } = await build()
        intake.lockPending.mockResolvedValue(row)
        await expect(service.lock(manager, "sepay-feed", DELIVERY)).resolves.toEqual({ payload, owner, row })
        expect(intake.lockPending).toHaveBeenCalledWith(manager, "sepay.delivery", CONNECTION, "sepay:42")
    })

    it("returns undefined when no delivery is pending", async () => {
        const { service, manager } = await build()
        await expect(service.lock(manager, "payos", DELIVERY)).resolves.toBeUndefined()
        await expect(service.lock(manager, "payos", "delivery-1")).resolves.toBeUndefined()
    })

    it("completes the locked delivery row", async () => {
        const { service, intake, manager } = await build()
        await service.complete(manager, { payload, owner, row })
        expect(intake.complete).toHaveBeenCalledWith(manager, row)
    })

    it("propagates a failed lock to the transaction owner", async () => {
        const { service, intake, manager } = await build()
        const failure = new Error("database failed")
        intake.lockPending.mockRejectedValue(failure)
        await expect(service.lock(manager, "payos", DELIVERY)).rejects.toBe(failure)
    })
})
