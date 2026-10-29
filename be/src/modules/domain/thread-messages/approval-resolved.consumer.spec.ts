import { mock } from "@starci/jest-preset"
import { ApprovalResolvedEvent } from "@modules/events/api"
import { APPROVAL_RESOLVED_THREAD_OUTCOMES_TOPIC_QUEUE } from "@modules/platform/event-bus"
import type { EventConsumerRegistry, EventDelivery } from "@modules/platform/event-bus"
import { ApprovalResolvedConsumer } from "./approval-resolved.consumer"
import type { ThreadApprovalOutcomesService } from "./thread-approval-outcomes.service"

const delivery = (): EventDelivery<ApprovalResolvedEvent> => {
    const event = ApprovalResolvedEvent.create({
        requestId: "req-1",
        workspaceId: "ws-1",
        outcome: "rejected",
        decidedBy: "minh",
        action: "give_discount",
        chainStepId: "step-1",
    })
    return {
        correlationId: "req-1",
        eventId: event.eventId,
        consumer: APPROVAL_RESOLVED_THREAD_OUTCOMES_TOPIC_QUEUE,
        dedupeKey: event.payload.dedupeKey,
        event,
        attempt: 1,
    }
}

describe("ApprovalResolvedConsumer", () => {
    const build = () => {
        const registry = mock<EventConsumerRegistry>()
        const outcomes = mock<ThreadApprovalOutcomesService>()
        outcomes.resolved.mockResolvedValue(undefined)
        return { registry, outcomes, subject: new ApprovalResolvedConsumer(registry, outcomes) }
    }

    it("subscribes to the thread_outcomes queue of approval_resolved", () => {
        const { registry, subject } = build()

        subject.onModuleInit()

        expect(registry.subscribe).toHaveBeenCalledWith("approval_resolved__thread_outcomes", subject)
    })

    it("has the card settled with the verdict and the delivery's inbox key", async () => {
        const { outcomes, subject } = build()

        await subject.handle(delivery())

        expect(outcomes.resolved).toHaveBeenCalledWith(
            { requestId: "req-1", outcome: "rejected", decidedBy: "minh" },
            { consumer: "approval_resolved__thread_outcomes", dedupeKey: "req-1" },
        )
    })

    it("lets a failure reach the bus so the message is retried", async () => {
        const { outcomes, subject } = build()
        const cause = new Error("db down")
        outcomes.resolved.mockRejectedValue(cause)

        await expect(subject.handle(delivery())).rejects.toBe(cause)
    })
})

describe("ApprovalResolvedEvent", () => {
    it("reads back what create wrote and refuses a malformed envelope", () => {
        const event = delivery().event

        expect(ApprovalResolvedEvent.parse({ eventId: event.eventId, payload: event.payload })?.payload).toEqual(
            event.payload,
        )
        expect(
            ApprovalResolvedEvent.parse({ eventId: "req-1", payload: { ...event.payload, outcome: "maybe" } }),
        ).toBeNull()
        expect(ApprovalResolvedEvent.parse({ eventId: "req-1", payload: { requestId: "" } })).toBeNull()
        expect(ApprovalResolvedEvent.parse(null)).toBeNull()
    })
})
