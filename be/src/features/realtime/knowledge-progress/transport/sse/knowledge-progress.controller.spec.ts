import { METHOD_METADATA, PATH_METADATA, SSE_METADATA } from "@nestjs/common/constants"
import type { MessageEvent } from "@nestjs/common"
import { RequestMethod } from "@nestjs/common"
import { Observable } from "rxjs"
import { knowledgeProgressTopic } from "@modules/domain/knowledge-sources"
import type { Principal } from "@modules/platform/cqrs"
import type { RealtimeHub } from "@modules/platform/realtime"
import { KnowledgeProgressController } from "./knowledge-progress.controller"

const principal: Principal = { id: "person-1", role: "authenticated" }
const WS = "ws-1"
const EVENT: MessageEvent = {
    id: "progress:1",
    data: {
        id: "progress:1",
        kind: "progress",
        sourceId: "s1",
        status: "indexing",
        progress: 40,
        stage: "embed",
        done: 2,
        total: 5,
        error: null,
        chunkCount: 0,
        at: "2026-10-31T10:00:00.000Z",
    },
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

const build = (hub: RealtimeHub) => Promise.resolve(new KnowledgeProgressController(hub))

describe("KnowledgeProgressController", () => {
    it("streams the topic built from the authenticated principal and workspace", async () => {
        const { hub, streamed } = hubAnswering()
        const door = await build(hub)

        door.stream(principal, WS, undefined).subscribe().unsubscribe()

        expect(streamed).toEqual([{ topic: knowledgeProgressTopic(principal.id, WS).name, after: undefined }])
    })

    it("isolates another authenticated principal's topic", async () => {
        const { hub, streamed } = hubAnswering()
        const door = await build(hub)

        door.stream({ id: "person-2", role: "authenticated" }, WS, undefined).subscribe().unsubscribe()

        expect(streamed.map((entry) => entry.topic)).toEqual([knowledgeProgressTopic("person-2", WS).name])
        expect(streamed.map((entry) => entry.topic)).not.toContain(knowledgeProgressTopic(principal.id, WS).name)
    })

    it("resumes after the Last-Event-ID inside the caller's own topic", async () => {
        const { hub, streamed } = hubAnswering()
        const door = await build(hub)

        door.stream(principal, WS, "progress:0").subscribe().unsubscribe()

        expect(streamed).toEqual([{ topic: knowledgeProgressTopic(principal.id, WS).name, after: "progress:0" }])
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

        expect(released).toEqual([knowledgeProgressTopic(principal.id, WS).name])
    })

    it("is one GET event stream with no other handler", async () => {
        const { hub } = hubAnswering()
        const door = await build(hub)

        expect(Reflect.getMetadata(SSE_METADATA, door.stream)).toBe(true)
        expect(Reflect.getMetadata(METHOD_METADATA, door.stream)).toBe(RequestMethod.GET)
        expect(Reflect.getMetadata(PATH_METADATA, KnowledgeProgressController)).toBe("realtime/knowledge-progress")
        expect(Object.getOwnPropertyNames(KnowledgeProgressController.prototype)).toEqual(["constructor", "stream"])
    })
})
