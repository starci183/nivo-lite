import { METHOD_METADATA, PATH_METADATA, SSE_METADATA } from "@nestjs/common/constants"
import type { MessageEvent } from "@nestjs/common"
import { RequestMethod } from "@nestjs/common"
import { Observable } from "rxjs"
import { chatActivityTopic } from "@modules/domain/chat-activity"
import type { Principal } from "@modules/platform/cqrs"
import type { RealtimeHub } from "@modules/platform/realtime"
import { ChatActivityController } from "./chat-activity.controller"

const principal: Principal = { id: "person-1", role: "authenticated" }
const WS = "ws-1"
const EVENT: MessageEvent = {
    id: "message:1",
    data: { id: "message:1", kind: "message", roomOrConversation: "room:sales", at: "2026-10-26T01:00:00.000Z" },
}

/** A recording hub whose event stream yields one event and records the topic, the resume point and the release. */
const hubAnswering = () => {
    const streamed: Array<{ readonly topic: string; readonly after: string | undefined }> = []
    const released: Array<string> = []
    const hub: RealtimeHub = {
        publish: () => Promise.resolve(),
        subscribe: () => ({
            [Symbol.asyncIterator]: () => ({ next: () => Promise.resolve({ done: true, value: undefined }) }),
        }),
        subscriberCount: () => 0,
        stream: (topic, options) => {
            streamed.push({ topic: topic.name, after: options?.after })
            return new Observable<MessageEvent>((subscriber) => {
                subscriber.next(EVENT)
                return () => {
                    released.push(topic.name)
                }
            })
        },
    }
    return { hub, streamed, released }
}

const build = (hub: RealtimeHub) => Promise.resolve(new ChatActivityController(hub))

describe("ChatActivityController", () => {
    it("streams the topic built from the authenticated principal and workspace", async () => {
        const { hub, streamed } = hubAnswering()
        const door = await build(hub)

        door.stream(principal, WS, undefined).subscribe().unsubscribe()

        expect(streamed).toEqual([{ topic: chatActivityTopic(principal.id, WS).name, after: undefined }])
    })

    it("isolates another authenticated principal's topic", async () => {
        const { hub, streamed } = hubAnswering()
        const door = await build(hub)

        door.stream({ id: "person-2", role: "authenticated" }, WS, undefined).subscribe().unsubscribe()

        expect(streamed.map((entry) => entry.topic)).toEqual([chatActivityTopic("person-2", WS).name])
        expect(streamed.map((entry) => entry.topic)).not.toContain(chatActivityTopic(principal.id, WS).name)
    })

    it("resumes after the Last-Event-ID inside the caller's own topic", async () => {
        const { hub, streamed } = hubAnswering()
        const door = await build(hub)

        door.stream(principal, WS, "message:0").subscribe().unsubscribe()

        expect(streamed).toEqual([{ topic: chatActivityTopic(principal.id, WS).name, after: "message:0" }])
    })

    it("hands the events of the hub to the response as they are", async () => {
        const { hub } = hubAnswering()
        const door = await build(hub)
        const received: Array<MessageEvent> = []

        door.stream(principal, WS, undefined)
            .subscribe((event) => received.push(event))
            .unsubscribe()

        expect(received).toEqual([EVENT])
    })

    it("releases the hub stream when the client disconnects", async () => {
        const { hub, released } = hubAnswering()
        const door = await build(hub)

        door.stream(principal, WS, undefined).subscribe().unsubscribe()

        expect(released).toEqual([chatActivityTopic(principal.id, WS).name])
    })

    it("is one GET event stream with no other handler", async () => {
        const { hub } = hubAnswering()
        const door = await build(hub)

        expect(Reflect.getMetadata(SSE_METADATA, door.stream)).toBe(true)
        expect(Reflect.getMetadata(METHOD_METADATA, door.stream)).toBe(RequestMethod.GET)
        expect(Reflect.getMetadata(PATH_METADATA, ChatActivityController)).toBe("realtime/office-activity")
        expect(Object.getOwnPropertyNames(ChatActivityController.prototype)).toEqual(["constructor", "stream"])
    })
})
