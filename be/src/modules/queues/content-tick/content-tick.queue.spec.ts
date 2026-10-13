import {
    CONTENT_TICK_EVERY_MS,
    CONTENT_TICK_QUEUE,
    CONTENT_TICK_SCHEDULER,
    contentTickPayloadOf,
} from "./content-tick.queue"

describe("content tick queue", () => {
    it("ticks every quarter hour", () => {
        expect(CONTENT_TICK_QUEUE).toBe("content_tick")
        expect(CONTENT_TICK_SCHEDULER).toBe("content-tick")
        expect(CONTENT_TICK_EVERY_MS).toBe(900_000)
    })

    it("keeps a workspace and a force flag only when they are usable", () => {
        expect(contentTickPayloadOf({ workspaceId: "ws-1", force: true, extra: 1 })).toEqual({
            workspaceId: "ws-1",
            force: true,
        })
        expect(contentTickPayloadOf({})).toEqual({})
        expect(contentTickPayloadOf({ workspaceId: 1, force: false })).toEqual({})
        expect(contentTickPayloadOf({ workspaceId: "ws-1" })).toEqual({ workspaceId: "ws-1" })
        expect(contentTickPayloadOf({ force: true })).toEqual({ force: true })
    })
})
