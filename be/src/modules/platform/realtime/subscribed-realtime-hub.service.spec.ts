import type { MessageEvent } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { RealtimeTopic } from "./realtime.port"
import { SubscribedRealtimeHub } from "./subscribed-realtime-hub.service"

interface Frame {
    readonly id: string
    readonly value: number
}

const isFrame = (value: unknown): value is Frame =>
    typeof value === "object" && value !== null && "id" in value && "value" in value

const topicOf = (name: string): RealtimeTopic<Frame> => ({ name, accepts: isFrame })

const frameOf = (value: number): Frame => ({ id: `e-${value}`, value })

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [SubscribedRealtimeHub] }).compile()
    return moduleRef.get(SubscribedRealtimeHub)
}

describe("SubscribedRealtimeHub", () => {
    it("pushes a published frame to every subscription of the topic in this process, in order", async () => {
        const hub = await build()
        const topic = topicOf("t:local")
        const first = hub.subscribe(topic)[Symbol.asyncIterator]()
        const second = hub.subscribe(topic)[Symbol.asyncIterator]()
        expect(hub.subscriberCount(topic)).toBe(2)

        await hub.publish(topic, frameOf(1))
        await hub.publish(topic, frameOf(2))

        await expect(first.next()).resolves.toEqual({ done: false, value: frameOf(1) })
        await expect(first.next()).resolves.toEqual({ done: false, value: frameOf(2) })
        await expect(second.next()).resolves.toEqual({ done: false, value: frameOf(1) })
        await first.return?.()
        await second.return?.()
        expect(hub.subscriberCount(topic)).toBe(0)
    })

    it("carries a frame without a string id as live only, and retains nothing for a reconnect", async () => {
        const hub = await build()
        const topic: RealtimeTopic<{ readonly value: number }> = {
            name: "t:noid",
            accepts: (value: unknown): value is { readonly value: number } => value !== undefined,
        }
        await hub.publish(topic, { value: 1 })

        const reader = hub.subscribe(topic, { after: "e-0" })[Symbol.asyncIterator]()
        await hub.publish(topic, { value: 2 })

        await expect(reader.next()).resolves.toEqual({ done: false, value: { value: 2 } })
        await reader.return?.()
    })

    it("streams the frames as server-sent events and releases the subscription on unsubscribe", async () => {
        const hub = await build()
        const topic = topicOf("t:sse")
        const events: Array<MessageEvent> = []

        const subscription = hub.stream(topic).subscribe((event) => events.push(event))
        await hub.publish(topic, frameOf(1))
        await new Promise<void>((resolve) => setImmediate(resolve))
        subscription.unsubscribe()

        expect(events).toEqual([
            { retry: 3000, comment: "open" },
            { id: "e-1", data: frameOf(1) },
        ])
        expect(hub.subscriberCount(topic)).toBe(0)
    })
})
