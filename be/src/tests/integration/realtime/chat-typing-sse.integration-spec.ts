import assert from "node:assert/strict"
import type { ChatTarget } from "@modules/domain/chat-markers"
import { eachInOrder } from "@modules/platform/primitives"
import { chatMarkersIdentity, persistChatMarkers } from "../../fixtures/builders/chat-markers.builder"
import { CLEAN_USERS } from "../../fixtures/persistence/office-chain.sql"
import { CLEAN_WORKSPACE } from "../../fixtures/persistence/proof.sql"
import { waitForProof } from "../../world/redis-proof.service"
import { useTestWorld } from "../../world/use-test-world"
import { withTypingReplicas } from "../../world/chat-typing-sse-proof.service"
import type { TypingStreamClient, TypingStreamFrame } from "../../world/realtime-stream-proof.service"

const world = useTestWorld({ modules: [] })
const identity = chatMarkersIdentity(() => world.id())
const OFFICE: ChatTarget = { room: null, conversationId: null }

/** The wire contract is independent of the GraphQL mutation's response shape. */
interface TypingFrame {
    readonly id: string
    readonly actorId: string
    readonly actorName: string
    readonly state: "start" | "stop"
    readonly at: string
}

const isTypingFrame = (value: unknown): value is TypingFrame =>
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "actorId" in value &&
    typeof value.actorId === "string" &&
    "actorName" in value &&
    typeof value.actorName === "string" &&
    "state" in value &&
    (value.state === "start" || value.state === "stop") &&
    "at" in value &&
    typeof value.at === "string"

const typingFrame = (wire: TypingStreamFrame | undefined): TypingFrame => {
    assert(wire !== undefined && isTypingFrame(wire.data), "Every default message must carry the typed typing frame")
    expect(wire.id).toBe(wire.data.id)
    expect(wire.id).toBe(`${wire.data.actorId}:${wire.data.at}`)
    expect(new Date(wire.data.at).toISOString()).toBe(wire.data.at)
    return wire.data
}

const opened = async (stream: TypingStreamClient): Promise<void> => {
    expect(stream.status).toBe(200)
    expect(stream.headers.get("content-type")).toContain("text/event-stream")
    expect(stream.headers.get("x-accel-buffering")).toBe("no")
    expect(stream.headers.get("cache-control")).toContain("no-transform")
    await waitForProof(
        () => Promise.resolve(stream.raw),
        (raw) => raw.includes(": open") && raw.includes("retry: 3000"),
    )
    expect(stream.readerError).toBeUndefined()
}

const received = async (stream: TypingStreamClient, count: number): Promise<void> => {
    await waitForProof(
        () => Promise.resolve(stream.frames.length),
        (length) => length >= count,
    )
    expect(stream.readerError).toBeUndefined()
    expect(stream.raw).not.toMatch(/^event:/m)
}

beforeAll(async () => {
    world.cleanup(async () => {
        await eachInOrder([identity.workspaceId, identity.foreignWorkspaceId], async (workspaceId) => {
            await world.db.primary.query(CLEAN_WORKSPACE, [workspaceId])
        })
        await world.db.primary.query(CLEAN_USERS, [
            [identity.ownerId, ...identity.readerIds, identity.outsiderId, identity.foreignOwnerId],
        ])
    })
    await persistChatMarkers(world.db.primary, identity)
})

describe("chat typing SSE delivery over private Supabase and shared Redis", () => {
    it("realtime/subscriber-receives-push: a member receives another member's start and stop as default SSE messages", async () => {
        await withTypingReplicas(world, identity, async (a) => {
            const stream = await a.open({
                principalId: identity.readerIds[0],
                workspaceId: identity.workspaceId,
                target: OFFICE,
            })
            await opened(stream)
            await a.typing.set(identity.ownerId, identity.workspaceId, OFFICE, true)
            await received(stream, 1)
            await a.typing.set(identity.ownerId, identity.workspaceId, OFFICE, false)
            await received(stream, 2)
            const start = typingFrame(stream.frames[0])
            const stop = typingFrame(stream.frames[1])
            expect(start).toMatchObject({ actorId: identity.ownerId, actorName: "Shared name", state: "start" })
            expect(stop).toMatchObject({ actorId: identity.ownerId, actorName: "Shared name", state: "stop" })
            expect(stop.id).not.toBe(start.id)
            expect(stream.frames).toHaveLength(2)
        })
    })

    it("realtime/push-crosses-replicas: publishing on one app reaches a member's real stream on the other", async () => {
        await withTypingReplicas(world, identity, async (a, b) => {
            const stream = await b.open({
                principalId: identity.readerIds[1],
                workspaceId: identity.workspaceId,
                target: OFFICE,
            })
            await opened(stream)
            const topic = b.topic(identity.readerIds[1], OFFICE)
            expect(a.hub.subscriberCount(topic)).toBe(0)
            expect(b.hub.subscriberCount(topic)).toBe(1)
            await a.typing.set(identity.ownerId, identity.workspaceId, OFFICE, true)
            await received(stream, 1)
            expect(typingFrame(stream.frames[0])).toMatchObject({ actorId: identity.ownerId, state: "start" })
            expect(stream.frames).toHaveLength(1)
        })
    })
})

describe("chat typing SSE admission and isolation", () => {
    it("realtime/foreign-topic-is-isolated: non-members, disabled members and foreign members open but never receive a typing frame", async () => {
        await withTypingReplicas(world, identity, async (a, b) => {
            const member = await b.open({
                principalId: identity.readerIds[0],
                workspaceId: identity.workspaceId,
                target: OFFICE,
            })
            const strangers = await Promise.all(
                [identity.outsiderId, identity.readerIds[4], identity.foreignOwnerId].map((principalId) =>
                    b.open({ principalId, workspaceId: identity.workspaceId, target: OFFICE }),
                ),
            )
            await opened(member)
            await eachInOrder(strangers, opened)
            await a.typing.set(identity.ownerId, identity.workspaceId, OFFICE, true)
            await a.typing.set(identity.ownerId, identity.workspaceId, OFFICE, false)
            await received(member, 2)
            expect(member.frames.map(typingFrame)).toEqual([
                expect.objectContaining({ actorId: identity.ownerId, state: "start" }),
                expect.objectContaining({ actorId: identity.ownerId, state: "stop" }),
            ])
            // The member's frames are the sentinel: the same publishes were already delivered, so silence here is isolation.
            strangers.forEach((stranger) => {
                expect(stranger.frames).toHaveLength(0)
                expect(stranger.raw).not.toContain("data:")
                expect(stranger.readerError).toBeUndefined()
            })
        })
    })
})

describe("chat typing SSE target isolation", () => {
    it("realtime/foreign-topic-is-isolated: a room stream excludes other rooms, conversations and workspaces through a sentinel", async () => {
        await withTypingReplicas(world, identity, async (a, b) => {
            const room: ChatTarget = { room: "sales", conversationId: null }
            const stream = await b.open({
                principalId: identity.readerIds[0],
                workspaceId: identity.workspaceId,
                target: room,
            })
            await opened(stream)
            await a.typing.set(
                identity.ownerId,
                identity.workspaceId,
                { room: "marketing", conversationId: null },
                true,
            )
            await a.typing.set(
                identity.ownerId,
                identity.workspaceId,
                { room: null, conversationId: identity.conversationIds[0] },
                true,
            )
            await a.typing.set(identity.foreignOwnerId, identity.foreignWorkspaceId, OFFICE, true)
            await a.typing.set(identity.ownerId, identity.workspaceId, room, false)
            await received(stream, 1)
            expect(stream.frames.map(typingFrame)).toEqual([
                expect.objectContaining({ actorId: identity.ownerId, actorName: "Shared name", state: "stop" }),
            ])
        })
    })

    it("realtime/subscriber-receives-push: authentication is default-deny and a URL token cannot authorize the door", async () => {
        await withTypingReplicas(world, identity, async (a) => {
            await eachInOrder([undefined, `proof-${identity.ownerId}`], async (queryToken) => {
                const stream = await a.open({
                    workspaceId: identity.workspaceId,
                    target: OFFICE,
                    ...(queryToken === undefined ? {} : { queryToken }),
                })
                expect(stream.status).toBe(401)
                await waitForProof(
                    () => Promise.resolve(stream.closed),
                    (closed) => closed,
                )
                expect(stream.raw).toContain("IDENTITY_UNAUTHENTICATED")
                expect(stream.raw).not.toContain(": open")
                expect(stream.frames).toHaveLength(0)
            })
        })
    })
})

describe("chat typing SSE resume and release", () => {
    it("realtime/resume-after-reconnect: Last-Event-ID replays missed frames on another replica and then resumes live", async () => {
        await withTypingReplicas(world, identity, async (a, b) => {
            const principalId = identity.readerIds[2]
            const initial = await a.open({ principalId, workspaceId: identity.workspaceId, target: OFFICE })
            await opened(initial)
            await a.typing.set(identity.ownerId, identity.workspaceId, OFFICE, true)
            await received(initial, 1)
            const cursor = typingFrame(initial.frames[0]).id
            await initial.disconnect()
            await waitForProof(
                () => Promise.resolve(a.hub.subscriberCount(a.topic(principalId, OFFICE))),
                (count) => count === 0,
            )
            await a.typing.set(identity.ownerId, identity.workspaceId, OFFICE, false)
            await a.typing.set(identity.readerIds[0], identity.workspaceId, OFFICE, true)
            const resumed = await b.open({
                principalId,
                workspaceId: identity.workspaceId,
                target: OFFICE,
                after: cursor,
            })
            await opened(resumed)
            await received(resumed, 2)
            expect(resumed.frames.map(typingFrame)).toEqual([
                expect.objectContaining({ actorId: identity.ownerId, state: "stop" }),
                expect.objectContaining({ actorId: identity.readerIds[0], state: "start" }),
            ])
            expect(resumed.frames.map((frame) => frame.id)).not.toContain(cursor)
            await a.typing.set(identity.readerIds[0], identity.workspaceId, OFFICE, false)
            await received(resumed, 3)
            expect(typingFrame(resumed.frames[2])).toMatchObject({ actorId: identity.readerIds[0], state: "stop" })
            expect(new Set(resumed.frames.map((frame) => frame.id)).size).toBe(3)
            expect(resumed.frames).toHaveLength(3)
        })
    })

    it("realtime/disconnect-releases-subscription: closing one stream releases it and leaves the other stream live", async () => {
        await withTypingReplicas(world, identity, async (a, b) => {
            const principalId = identity.readerIds[3]
            const topic = b.topic(principalId, OFFICE)
            const before = b.hub.subscriberCount(topic)
            const closing = await b.open({ principalId, workspaceId: identity.workspaceId, target: OFFICE })
            const survivor = await b.open({ principalId, workspaceId: identity.workspaceId, target: OFFICE })
            await opened(closing)
            await opened(survivor)
            await waitForProof(
                () => Promise.resolve(b.hub.subscriberCount(topic)),
                (count) => count === before + 2,
            )
            await closing.disconnect()
            expect(closing.closed).toBe(true)
            expect(closing.readerError).toBeUndefined()
            await waitForProof(
                () => Promise.resolve(b.hub.subscriberCount(topic)),
                (count) => count === before + 1,
            )
            await a.typing.set(identity.ownerId, identity.workspaceId, OFFICE, true)
            await received(survivor, 1)
            expect(typingFrame(survivor.frames[0])).toMatchObject({ actorId: identity.ownerId, state: "start" })
            expect(closing.frames).toHaveLength(0)
            await survivor.disconnect()
            expect(survivor.closed).toBe(true)
            expect(survivor.readerError).toBeUndefined()
            await waitForProof(
                () => Promise.resolve(b.hub.subscriberCount(topic)),
                (count) => count === before,
            )
        })
    })
})
