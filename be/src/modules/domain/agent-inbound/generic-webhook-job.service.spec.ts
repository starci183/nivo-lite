import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { ConnectionSecretReadsService } from "@modules/domain/connections"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentInboundErrorCode } from "./errors/agent-inbound.error"
import { GenericWebhookJobService } from "./generic-webhook-job.service"
import { InboundDoorService } from "./inbound-door.service"

const JOB = {
    connectionId: "conn-1",
    deliveryId: "conn-1:evt-1",
    rawBody: '{"type":"invoice.paid","id":"evt-1","amount":120}',
    eventType: null,
    deliveryKey: null,
}

const build = async (secret: unknown = { kind: "ok", value: { workspaceId: "ws-9", webhookSecret: "s" } }) => {
    const tx = fakeTransaction(mockEntityManager())
    const door = mock<InboundDoorService>({
        accept: jest.fn().mockResolvedValue({ accepted: true, agentIds: ["agent-1"] }),
    })
    const secrets = mock<ConnectionSecretReadsService>({ secretOf: jest.fn().mockResolvedValue(secret) })
    const container = await Test.createTestingModule({
        providers: [
            GenericWebhookJobService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: ConnectionSecretReadsService, useValue: secrets },
            { provide: InboundDoorService, useValue: door },
        ],
    }).compile()
    return { service: container.get(GenericWebhookJobService), tx, door, secrets }
}

describe("GenericWebhookJobService", () => {
    it("turns the receipt into the event of the endpoint workspace and hands it to the door in one transaction", async () => {
        const { service, tx, door, secrets } = await build()

        await service.run(JOB)

        expect(secrets.secretOf).toHaveBeenCalledWith("conn-1", "webhook")
        expect(tx.em.transaction).toHaveBeenCalledTimes(1)
        expect(door.accept).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                adapter: "generic_webhook",
                workspaceId: "ws-9",
                eventType: "invoice.paid",
                payload: { type: "invoice.paid", id: "evt-1", amount: 120 },
                idempotencyKey: "conn-1:evt-1",
                agentId: null,
            }),
        )
    })

    it("keeps the delivery id the inbox claimed as the idempotency key, and the headers the sender named", async () => {
        const { service, door } = await build()

        await service.run({ ...JOB, deliveryId: "conn-1:hdr-9", eventType: "invoice.refunded", deliveryKey: "hdr-9" })

        expect(door.accept).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ eventType: "invoice.refunded", idempotencyKey: "conn-1:hdr-9" }),
        )
    })

    it("ends the job with no retry for a payload that is no receipt", async () => {
        const { service, door } = await build()

        await expect(service.run({ nothing: true })).rejects.toEqual(
            expect.objectContaining({ code: AgentInboundErrorCode.JobPayloadInvalid, params: { unrecoverable: 1 } }),
        )
        expect(door.accept).not.toHaveBeenCalled()
    })

    it("ends the job with no retry for an endpoint that is gone", async () => {
        const { service, door } = await build({ kind: "refused", code: "NOT_FOUND" })

        await expect(service.run(JOB)).rejects.toEqual(
            expect.objectContaining({ code: AgentInboundErrorCode.EndpointUnknown, params: { unrecoverable: 1 } }),
        )
        expect(door.accept).not.toHaveBeenCalled()
    })
})
