import { Test } from "@nestjs/testing"
import assert from "node:assert/strict"
import { fakeInbox, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { INBOX } from "@modules/platform/inbox"
import { GENERIC_WEBHOOK_QUEUE_PRODUCER } from "@modules/queues/generic-webhook"
import type { GenericWebhookQueue } from "@modules/queues/generic-webhook"
import { AgentInboundErrorCode } from "./errors/agent-inbound.error"
import { GENERIC_WEBHOOK } from "./generic-webhook.adapter"
import { GenericWebhookIntakeService } from "./generic-webhook-intake.service"

const BODY = '{"type":"invoice.paid","id":"evt-1"}'

const delivery = {
    endpoint: "conn-1",
    rawBody: Buffer.from(BODY),
    signature: "sig",
    eventType: undefined,
    deliveryKey: undefined,
}

const build = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const inbox = fakeInbox()
    const queue = mock<GenericWebhookQueue>({ enqueueDeliver: jest.fn().mockResolvedValue(undefined) })
    const container = await Test.createTestingModule({
        providers: [
            GenericWebhookIntakeService,
            { provide: GENERIC_WEBHOOK_QUEUE_PRODUCER, useValue: queue },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: INBOX, useValue: inbox },
        ],
    }).compile()
    return { service: container.get(GenericWebhookIntakeService), tx, inbox, queue }
}

describe("GenericWebhookIntakeService", () => {
    it("claims the delivery in the inbox by the id its body names and queues the receipt in the same transaction", async () => {
        const { service, tx, inbox, queue } = await build()

        await expect(service.accept(delivery)).resolves.toBeUndefined()

        expect(tx.em.transaction).toHaveBeenCalledTimes(1)
        expect(inbox.claimed).toEqual([{ source: GENERIC_WEBHOOK, eventId: "conn-1:evt-1" }])
        expect(queue.enqueueDeliver).toHaveBeenCalledTimes(1)
        const manager = queue.enqueueDeliver.mock.calls[0]?.[1]
        assert(manager !== undefined)
        expect(manager).not.toBe(tx.em)
        expect(queue.enqueueDeliver).toHaveBeenCalledWith(
            {
                connectionId: "conn-1",
                deliveryId: "conn-1:evt-1",
                rawBody: BODY,
                eventType: null,
                deliveryKey: null,
            },
            manager,
        )
        expect(manager.queryRunner?.isTransactionActive).toBe(false)
        expect(tx.commits).toBe(1)
    })

    it("acknowledges a redelivery without queueing anything", async () => {
        const { service, inbox, queue } = await build()
        inbox.seen(GENERIC_WEBHOOK, "conn-1:evt-1")

        await expect(service.accept(delivery)).resolves.toBeUndefined()

        expect(queue.enqueueDeliver).not.toHaveBeenCalled()
    })

    it("queues nothing when the claim cannot be written, so the sender retries", async () => {
        const { service, inbox, queue } = await build()
        inbox.failNext("claim", new Error("inbox down"))

        await expect(service.accept(delivery)).rejects.toThrow("inbox down")
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
        const { service, inbox } = await build()

        await expect(service.accept({ ...delivery, rawBody: undefined })).rejects.toEqual(
            expect.objectContaining({ code: AgentInboundErrorCode.EndpointUnknown }),
        )
        await expect(service.accept({ ...delivery, rawBody: Buffer.from("[1]") })).rejects.toEqual(
            expect.objectContaining({ code: AgentInboundErrorCode.BodyInvalid }),
        )
        expect(inbox.claims).toEqual([])
    })
})
