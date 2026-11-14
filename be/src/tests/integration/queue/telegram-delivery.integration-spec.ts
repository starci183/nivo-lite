import {
    TELEGRAM_DELIVERY_QUEUE as DOMAIN_QUEUE,
    TELEGRAM_DELIVERY_QUEUE,
    isTelegramDeliveryRecorded,
} from "@modules/queues/telegram-delivery"
import { telegramDeliveryBuilder as build, telegramDeliveryState } from "../../world/telegram-delivery-proof.service"
import { useTestWorld } from "../../world/use-test-world"
import { TELEGRAM_PROOF_UPDATE } from "../../fixtures/builders/telegram-delivery.builder"
import { QUEUE_MODULES } from "../../world/test-capabilities.options"
import { ACCOUNT_DATA_PROOF_MODULES } from "../../world/account-data-proof.options"

/** A Jest type matcher as an untyped value, so it can stand in a typed expectation. */
const anyOf = (type: unknown): unknown => expect.any(type)

describe("Telegram delivery publication (persisted integration)", () => {
    const world = useTestWorld({ modules: [...QUEUE_MODULES, ...ACCOUNT_DATA_PROOF_MODULES] })
    it.each([
        undefined,
        null,
        1,
        "delivery-1",
        {},
        { deliveryId: null },
        { deliveryId: 42 },
        { deliveryId: "" },
        { deliveryId: "   " },
    ])("refuses malformed receipt references: %p", (value) => {
        expect(isTelegramDeliveryRecorded(value)).toBe(false)
    })

    it("accepts a durable receipt identity and agrees with the intake queue", () => {
        expect(isTelegramDeliveryRecorded({ deliveryId: "delivery-1" })).toBe(true)
        expect(TELEGRAM_DELIVERY_QUEUE).toBe(DOMAIN_QUEUE)
    })

    it("publishes in the caller transaction with the intake dedupe key", async () => {
        const { service, write, publication, body, connection, message } = await build(world)
        await service.acceptTelegramDelivery(body, connection)
        const manager = publication.write.mock.calls[0]?.[0]
        expect(write).toHaveBeenCalledWith(manager, TELEGRAM_DELIVERY_QUEUE, message, {
            dedupeKey: `telegram-delivery:${message.deliveryId}`,
        })
        const state = await telegramDeliveryState(world, message.deliveryId)
        expect(state.receipts).toHaveLength(1)
        expect(state.jobs).toHaveLength(1)
        expect(state.jobs[0]).toMatchObject({ payload: message, dedupe_key: `telegram-delivery:${message.deliveryId}` })
        expect(state.messages).toHaveLength(1)
        expect(state.messages[0]).toMatchObject({ message: { payload: message, outbox_id: state.jobs[0]?.id } })
    })

    it("a redelivery writes no second account_data row and queues nothing more", async () => {
        const { service, write, body, connection, message } = await build(world)
        await service.acceptTelegramDelivery(body, connection)
        const first = await telegramDeliveryState(world, message.deliveryId)
        await service.acceptTelegramDelivery(body, connection)
        const again = await telegramDeliveryState(world, message.deliveryId)
        expect(first.receipts).toEqual([
            { id: anyOf(String), payload: { updateId: "77", raw: TELEGRAM_PROOF_UPDATE }, processed_at: null },
        ])
        expect(again).toEqual(first)
        expect(write).toHaveBeenCalledTimes(1)
    })

    it("propagates publication failure so the caller can roll back", async () => {
        const { service, write, body, connection, message } = await build(world)
        const failure = new Error("publication failed")
        write.mockRejectedValue(failure)
        await expect(service.acceptTelegramDelivery(body, connection)).rejects.toBe(failure)
        expect(await telegramDeliveryState(world, message.deliveryId)).toEqual({ receipts: [], jobs: [], messages: [] })
    })
})
