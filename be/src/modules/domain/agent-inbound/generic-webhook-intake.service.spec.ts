import { Test } from "@nestjs/testing"
import { fakeInbox, fakeTransaction, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { INBOX } from "@modules/platform/inbox"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
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
    const outbox = recordingQueueOutbox()
    const container = await Test.createTestingModule({
        providers: [
            GenericWebhookIntakeService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: INBOX, useValue: inbox },
            { provide: QUEUE_OUTBOX, useValue: outbox },
        ],
    }).compile()
    return { service: container.get(GenericWebhookIntakeService), tx, inbox, outbox }
}

describe("GenericWebhookIntakeService", () => {
    it("claims the delivery in the inbox by the id its body names and queues the receipt in the same transaction", async () => {
        const { service, tx, inbox, outbox } = await build()

        await expect(service.accept(delivery)).resolves.toBeUndefined()

        expect(tx.em.transaction).toHaveBeenCalledTimes(1)
        expect(inbox.claimed).toEqual([{ source: GENERIC_WEBHOOK, eventId: "conn-1:evt-1" }])
        expect(outbox.jobsOf("generic_webhook")).toEqual([
            {
                queue: "generic_webhook",
                payload: {
                    connectionId: "conn-1",
                    deliveryId: "conn-1:evt-1",
                    rawBody: BODY,
                    eventType: null,
                    deliveryKey: null,
                },
            },
        ])
        expect(outbox.allInTransaction).toBe(true)
    })

    it("acknowledges a redelivery without queueing anything", async () => {
        const { service, inbox, outbox } = await build()
        inbox.seen(GENERIC_WEBHOOK, "conn-1:evt-1")

        await expect(service.accept(delivery)).resolves.toBeUndefined()

        expect(outbox.jobs).toEqual([])
    })

    it("queues nothing when the claim cannot be written, so the sender retries", async () => {
        const { service, inbox, outbox } = await build()
        inbox.failNext("claim", new Error("inbox down"))

        await expect(service.accept(delivery)).rejects.toThrow("inbox down")
        expect(outbox.jobs).toEqual([])
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
