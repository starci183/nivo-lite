import { CqrsModule } from "@nestjs/cqrs"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { BankFeedPollTriggerService } from "@modules/domain/billing"
import { ConnectionReadyEvent } from "@modules/events/api"
import {
    CONNECTION_READY_BANK_FEED_POLL_TOPIC_QUEUE,
    type BaseEvent,
    type EventConsumer,
    type EventConsumerRegistry,
} from "@modules/platform/event-bus"
import { BankFeedPollMessageModule } from "@features/reactors/bank-feed-poll"

const payload = { workspaceId: "ws-1", connectionId: "conn-1", provider: "sepay", dedupeKey: "conn-1:api_token:abc" }

/** The composed message module over a real command bus: only the trigger service and the consumer registry are doubles. */
const compose = async () => {
    const trigger = mock<BankFeedPollTriggerService>()
    trigger.enqueueFirstPoll.mockResolvedValue(true)
    const subscriptions: Array<{ queue: string; consumer: EventConsumer<BaseEvent> }> = []
    const shared = mock<EventConsumerRegistry>()
    shared.subscribe.mockImplementation((queue, consumer) => {
        subscriptions.push({ queue, consumer })
    })
    const moduleRef = await Test.createTestingModule({
        imports: [CqrsModule.forRoot(), BankFeedPollMessageModule.register({})],
    })
        .useMocker((dependency) => (dependency === BankFeedPollTriggerService ? trigger : shared))
        .compile()
    await moduleRef.init()
    return { trigger, subscriptions }
}

describe("bank-feed-poll reactor", () => {
    it("subscribes the consumer to its queue and the command it dispatches has a handler on the command bus", async () => {
        const { trigger, subscriptions } = await compose()
        const [subscription] = subscriptions

        expect(subscriptions).toHaveLength(1)
        expect(subscription?.queue).toBe(CONNECTION_READY_BANK_FEED_POLL_TOPIC_QUEUE)
        await subscription?.consumer.handle({
            eventId: payload.dedupeKey,
            correlationId: "c-1",
            consumer: CONNECTION_READY_BANK_FEED_POLL_TOPIC_QUEUE,
            dedupeKey: payload.dedupeKey,
            event: ConnectionReadyEvent.create(payload),
            attempt: 1,
        })

        expect(trigger.enqueueFirstPoll).toHaveBeenCalledWith(payload)
    })
})
