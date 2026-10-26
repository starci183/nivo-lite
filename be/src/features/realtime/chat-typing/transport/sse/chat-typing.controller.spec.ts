import { METHOD_METADATA, PATH_METADATA, SSE_METADATA } from "@nestjs/common/constants"
import type { MessageEvent } from "@nestjs/common"
import { RequestMethod } from "@nestjs/common"
import { Observable } from "rxjs"
import { chatTypingTopic } from "@modules/domain/chat-typing"
import type { Principal } from "@modules/platform/cqrs"
import type { RealtimeHub, RealtimeTopic } from "@modules/platform/realtime"
import { ChatTypingController } from "./chat-typing.controller"

const principal: Principal = { id: "person-1", role: "authenticated" }
const WS = "ws-1"
const ROOM = { room: "sales", conversationId: null }
const EVENT: MessageEvent = { id: "a:t", data: { id: "a:t", actorId: "a", actorName: "An", state: "start", at: "t" } }

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
        stream: (topic: RealtimeTopic<never>, options?: Parameters<RealtimeHub["stream"]>[1]) => {
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

const build = (hub: RealtimeHub) => Promise.resolve(new ChatTypingController(hub))

describe("ChatTypingController", () => {
    it("streams the topic built from the authenticated principal, workspace and target", async () => {
        const { hub, streamed } = hubAnswering()
        const door = await build(hub)

        door.stream(principal, WS, { room: "sales", conversationId: null }, undefined).subscribe().unsubscribe()

        expect(streamed).toEqual([{ topic: chatTypingTopic(principal.id, WS, ROOM).name, after: undefined }])
    })

    it("streams a conversation target", async () => {
        const { hub, streamed } = hubAnswering()
        const door = await build(hub)

        door.stream(principal, WS, { room: null, conversationId: "c-1" }, undefined).subscribe().unsubscribe()

        expect(streamed.map((entry) => entry.topic)).toEqual([
            chatTypingTopic(principal.id, WS, { room: null, conversationId: "c-1" }).name,
        ])
    })

    it("isolates another authenticated principal's topic", async () => {
        const { hub, streamed } = hubAnswering()
        const door = await build(hub)

        door.stream({ id: "person-2", role: "authenticated" }, WS, ROOM, undefined).subscribe().unsubscribe()

        expect(streamed.map((entry) => entry.topic)).toEqual([chatTypingTopic("person-2", WS, ROOM).name])
        expect(streamed.map((entry) => entry.topic)).not.toContain(chatTypingTopic(principal.id, WS, ROOM).name)
    })

    it("resumes after the Last-Event-ID inside the caller's own topic", async () => {
        const { hub, streamed } = hubAnswering()
        const door = await build(hub)

        door.stream(principal, WS, ROOM, "a:t0").subscribe().unsubscribe()

        expect(streamed).toEqual([{ topic: chatTypingTopic(principal.id, WS, ROOM).name, after: "a:t0" }])
    })

    it("hands the events of the hub to the response as they are", async () => {
        const { hub } = hubAnswering()
        const door = await build(hub)
        const received: Array<MessageEvent> = []

        door.stream(principal, WS, ROOM, undefined)
            .subscribe((event) => received.push(event))
            .unsubscribe()

        expect(received).toEqual([EVENT])
    })

    it("releases the hub stream when the client disconnects", async () => {
        const { hub, released } = hubAnswering()
        const door = await build(hub)

        door.stream(principal, WS, ROOM, undefined).subscribe().unsubscribe()

        expect(released).toEqual([chatTypingTopic(principal.id, WS, ROOM).name])
    })

    it("is one GET event stream with no other handler", async () => {
        const { hub } = hubAnswering()
        const door = await build(hub)

        expect(Reflect.getMetadata(SSE_METADATA, door.stream)).toBe(true)
        expect(Reflect.getMetadata(METHOD_METADATA, door.stream)).toBe(RequestMethod.GET)
        expect(Reflect.getMetadata(PATH_METADATA, ChatTypingController)).toBe("realtime/chat-typing")
        expect(Object.getOwnPropertyNames(ChatTypingController.prototype)).toEqual(["constructor", "stream"])
    })
})
