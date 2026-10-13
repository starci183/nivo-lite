import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import type { WorkContext } from "@modules/domain/decisions"
import { WebhookEventsService } from "@modules/domain/webhook-connections"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { AUTOMATION_QUEUE } from "@modules/queues/automation"
import { AutomationBusinessEventsService } from "./automation-business-events.service"

const CTX: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "vi" }
const PAYLOAD = { work_item_id: "wi-1", action: "send_quote", outcome: "approved", decided_by: "Lan" }
const KEY = "decision.made:wi-1:approved"

const build = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const outbox = recordingQueueOutbox()
    const webhooks = mock<WebhookEventsService>()
    webhooks.publish.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AutomationBusinessEventsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: QUEUE_OUTBOX, useValue: outbox },
            { provide: WebhookEventsService, useValue: webhooks },
        ],
    }).compile()
    return { tx, outbox, webhooks, events: moduleRef.get(AutomationBusinessEventsService) }
}

describe("AutomationBusinessEventsService", () => {
    it("queues the decision for the automation engine and the subscribed webhooks in one transaction", async () => {
        const { tx, outbox, webhooks, events } = await build()

        await expect(events.decisionMade(CTX, PAYLOAD, KEY)).resolves.toBeUndefined()

        expect(outbox.jobsOf(AUTOMATION_QUEUE)).toEqual([
            {
                queue: AUTOMATION_QUEUE,
                payload: {
                    kind: "business_event",
                    event: "decision.made",
                    workspaceId: "ws-1",
                    dedupe: KEY,
                    data: PAYLOAD,
                },
            },
        ])
        expect(outbox.allInTransaction).toBe(true)
        expect(tx.commits).toBe(1)
        expect(webhooks.publish).toHaveBeenCalledWith(
            { workspaceId: "ws-1", event: "decision.made", data: PAYLOAD, dedupe: KEY },
            expect.anything(),
        )
    })

    it("rolls the automation job back when the webhooks cannot be queued", async () => {
        const { tx, webhooks, events } = await build()
        webhooks.publish.mockRejectedValue(new Error("down"))

        await expect(events.decisionMade(CTX, PAYLOAD, KEY)).rejects.toThrow("down")

        expect(tx.rollbacks).toBe(1)
    })

    it("publishes any business event under its own name", async () => {
        const { outbox, webhooks, events } = await build()
        const data = { order_id: "o-1", order_no: "DH-1" }

        await events.publish("ws-1", "order.confirmed", data, "order.confirmed:o-1")

        expect(outbox.jobsOf(AUTOMATION_QUEUE)).toEqual([
            {
                queue: AUTOMATION_QUEUE,
                payload: {
                    kind: "business_event",
                    event: "order.confirmed",
                    workspaceId: "ws-1",
                    dedupe: "order.confirmed:o-1",
                    data,
                },
            },
        ])
        expect(webhooks.publish).toHaveBeenCalledWith(
            { workspaceId: "ws-1", event: "order.confirmed", data, dedupe: "order.confirmed:o-1" },
            expect.anything(),
        )
    })
})
