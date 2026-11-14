import { Test } from "@nestjs/testing"
import assert from "node:assert/strict"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { AccountDataIntakeService, schemaOf } from "@modules/domain/account-data"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { GENERIC_WEBHOOK_QUEUE_PRODUCER } from "@modules/queues/generic-webhook"
import type { GenericWebhookQueue } from "@modules/queues/generic-webhook"
import { AgentInboundErrorCode } from "./errors/agent-inbound.error"
import { GenericWebhookIntakeService } from "./generic-webhook-intake.service"
import { WEBHOOK_DATA_TYPES, webhookDelivery } from "./webhook.data-types"

/** A real-shaped event a system posts to the endpoint, and its exact bytes. */
const EVENT = { type: "invoice.paid", id: "evt-1", data: { amount: 120_000 } }
const BODY = JSON.stringify(EVENT)

const delivery = {
    endpoint: "conn-1",
    rawBody: Buffer.from(BODY),
    signature: "sig",
    eventType: undefined,
    deliveryKey: undefined,
}

/** The row the intake answers for a delivery it claimed new. */
const CLAIMED = { type: "webhook.delivery", key: "evt-1", id: "row-1", isNew: true }

/** `isNew` false: the store answers no row, as it does on a repeat or for an endpoint nobody holds. */
const build = async (isNew = true) => {
    const tx = fakeTransaction(mockEntityManager())
    const intake = mock<AccountDataIntakeService>()
    intake.claim.mockResolvedValue(isNew ? CLAIMED : undefined)
    const queue = mock<GenericWebhookQueue>({ enqueueDeliver: jest.fn().mockResolvedValue(undefined) })
    const container = await Test.createTestingModule({
        providers: [
            GenericWebhookIntakeService,
            { provide: GENERIC_WEBHOOK_QUEUE_PRODUCER, useValue: queue },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: AccountDataIntakeService, useValue: intake },
        ],
    }).compile()
    return { service: container.get(GenericWebhookIntakeService), tx, intake, queue }
}

describe("webhook data types", () => {
    it("declares the delivery of a generic webhook endpoint: append, no wake, swept after 30 days", () => {
        expect(WEBHOOK_DATA_TYPES.map((def) => [def.name, def.provider, def.write, def.wakes, def.retention])).toEqual([
            ["webhook.delivery", "webhook", "append", false, { days: 30 }],
        ])
        expect(webhookDelivery.secretFields).toContain("webhookSecret")
    })
})

describe("GenericWebhookIntakeService", () => {
    it("claims the delivery as a webhook.delivery row of the endpoint's account under the id its body names and queues the receipt once in the same transaction", async () => {
        const { service, tx, intake, queue } = await build()

        await expect(service.accept(delivery)).resolves.toBeUndefined()

        expect(tx.em.transaction).toHaveBeenCalledTimes(1)
        expect(queue.enqueueDeliver).toHaveBeenCalledTimes(1)
        const manager = queue.enqueueDeliver.mock.calls[0]?.[1]
        assert(manager !== undefined)
        expect(manager).not.toBe(tx.em)
        const claim = { connectionId: "conn-1", type: "webhook.delivery", value: { deliveryId: "evt-1", raw: EVENT } }
        expect(intake.claim.mock.calls).toEqual([[manager, claim]])
        expect(intake.write).not.toHaveBeenCalled()
        expect(schemaOf(webhookDelivery).safeParse(claim.value).success).toBe(true)
        expect(queue.enqueueDeliver).toHaveBeenCalledWith(
            { connectionId: "conn-1", deliveryId: "conn-1:evt-1", rawBody: BODY, eventType: null, deliveryKey: null },
            manager,
        )
        expect(tx.commits).toBe(1)
    })

    it("keeps the sender's event type and delivery key headers beside the body", async () => {
        const { service, intake } = await build()

        await service.accept({ ...delivery, eventType: "invoice.paid", deliveryKey: "dk-1" })

        expect(intake.claim.mock.calls[0]?.[1]).toEqual({
            connectionId: "conn-1",
            type: "webhook.delivery",
            value: { deliveryId: "dk-1", eventType: "invoice.paid", deliveryKey: "dk-1", raw: EVENT },
        })
    })
})

describe("GenericWebhookIntakeService redeliveries and failures", () => {
    it.each<[string]>([["a redelivery"], ["an endpoint nobody holds"]])(
        "acknowledges %s (the claim answers no row) without queueing anything",
        async () => {
            const { service, tx, queue } = await build(false)

            await expect(service.accept(delivery)).resolves.toBeUndefined()

            expect(queue.enqueueDeliver).not.toHaveBeenCalled()
            expect(tx.commits).toBe(1)
        },
    )

    it("keeps a long key's opaque digest whole as the row's id", async () => {
        const { service, intake } = await build()
        const deliveryKey = "k".repeat(300)

        await service.accept({ ...delivery, deliveryKey })

        const row = intake.claim.mock.calls[0]?.[1]
        expect(row?.value).toMatchObject({ deliveryKey })
        expect(JSON.stringify(row?.value)).toMatch(/"deliveryId":"webhook-sha256:[0-9a-f]{64}"/u)
    })

    it("queues nothing when the row cannot be written, so the sender retries", async () => {
        const { service, intake, queue } = await build()
        intake.claim.mockRejectedValue(new Error("store down"))

        await expect(service.accept(delivery)).rejects.toThrow("store down")
        expect(queue.enqueueDeliver).not.toHaveBeenCalled()
    })

    it("rolls the receipt transaction back when its producer cannot persist the delivery", async () => {
        const { service, tx, queue } = await build()
        queue.enqueueDeliver.mockRejectedValue(new Error("outbox down"))

        await expect(service.accept(delivery)).rejects.toThrow("outbox down")

        expect(tx.rollbacks).toBe(1)
        expect(tx.commits).toBe(0)
    })

    it("refuses a delivery that is no event before it claims anything", async () => {
        const { service, intake } = await build()

        await expect(service.accept({ ...delivery, rawBody: undefined })).rejects.toEqual(
            expect.objectContaining({ code: AgentInboundErrorCode.EndpointUnknown }),
        )
        await expect(service.accept({ ...delivery, rawBody: Buffer.from("[1]") })).rejects.toEqual(
            expect.objectContaining({ code: AgentInboundErrorCode.BodyInvalid }),
        )
        expect(intake.claim).not.toHaveBeenCalled()
    })
})
