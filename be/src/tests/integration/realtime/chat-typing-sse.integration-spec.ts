import assert from "node:assert/strict"
import type { ChatRoomView, TeamChatResult } from "@modules/domain/team-chat"
import { eachInOrder } from "@modules/platform/primitives"
import { persistTeamChat, teamChatIdentity } from "../../fixtures/builders/team-chat.builder"
import { waitForProof } from "../../world/redis-proof.service"
import { useTestWorld } from "../../world/use-test-world"
import { withTypingReplicas } from "../../world/chat-typing-sse-proof.service"
import type { TypingStreamClient, TypingStreamFrame } from "../../world/realtime-stream-proof.service"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"

const world = useTestWorld({ modules: [] })
const identity = teamChatIdentity(() => world.id())
const [first, second, third] = identity.staffIds

/** The rooms of the proof: one with the three staff, one with the first staff only, one in the other workspace. */
const rooms = { shared: "", narrow: "", foreign: "" }

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

const member = (memberId: string) => ({ memberKind: "user" as const, memberId })

const roomIdOf = (result: TeamChatResult<ChatRoomView>): string => {
    assert(result.ok, "the room must be created")
    return result.value.id
}

beforeAll(async () => {
    world.cleanup(async () => {
        await eachInOrder([identity.workspaceId, identity.foreignWorkspaceId], async (workspaceId) => {
            await removeWorkspace(world.db.primary, workspaceId)
        })
        await removeAuthUsers(world.db.primary, [identity.ownerId, ...identity.staffIds, identity.outsiderId])
    })
    await persistTeamChat(world.db.primary, identity)
    await withTypingReplicas(world, identity, async (a) => {
        const chat = a.team
        rooms.shared = roomIdOf(
            await chat.createRoom(identity.workspaceId, identity.ownerId, {
                kind: "group",
                name: "Shared",
                members: identity.staffIds.map((memberId) => member(memberId)),
            }),
        )
        rooms.narrow = roomIdOf(
            await chat.createRoom(identity.workspaceId, identity.ownerId, {
                kind: "group",
                name: "Narrow",
                members: [member(first)],
            }),
        )
        rooms.foreign = roomIdOf(
            await chat.createRoom(identity.foreignWorkspaceId, identity.outsiderId, {
                kind: "group",
                name: "Foreign",
                members: [],
            }),
        )
    })
})

describe("chat typing SSE delivery over private PostgreSQL and shared Redis", () => {
    it("realtime/subscriber-receives-push: a member receives another member's start and stop as default SSE messages", async () => {
        await withTypingReplicas(world, identity, async (a) => {
            const stream = await a.open({
                principalId: first,
                workspaceId: identity.workspaceId,
                roomId: rooms.shared,
            })
            await opened(stream)
            await a.typing.set(identity.ownerId, identity.workspaceId, rooms.shared, true)
            await received(stream, 1)
            await a.typing.set(identity.ownerId, identity.workspaceId, rooms.shared, false)
            await received(stream, 2)
            const start = typingFrame(stream.frames[0])
            const stop = typingFrame(stream.frames[1])
            expect(start).toMatchObject({ actorId: identity.ownerId, actorName: "Owner", state: "start" })
            expect(stop).toMatchObject({ actorId: identity.ownerId, actorName: "Owner", state: "stop" })
            expect(stop.id).not.toBe(start.id)
            expect(stream.frames).toHaveLength(2)
        })
    })

    it("realtime/push-crosses-replicas: publishing on one app reaches a member's real stream on the other", async () => {
        await withTypingReplicas(world, identity, async (a, b) => {
            const stream = await b.open({
                principalId: second,
                workspaceId: identity.workspaceId,
                roomId: rooms.shared,
            })
            await opened(stream)
            const topic = b.topic(second, rooms.shared)
            expect(a.hub.subscriberCount(topic)).toBe(0)
            expect(b.hub.subscriberCount(topic)).toBe(1)
            await a.typing.set(identity.ownerId, identity.workspaceId, rooms.shared, true)
            await received(stream, 1)
            expect(typingFrame(stream.frames[0])).toMatchObject({ actorId: identity.ownerId, state: "start" })
            expect(stream.frames).toHaveLength(1)
        })
    })
})

describe("chat typing SSE admission and isolation", () => {
    it("realtime/foreign-topic-is-isolated: people outside the room, and people of another workspace, open but never receive a typing frame", async () => {
        await withTypingReplicas(world, identity, async (a, b) => {
            const member = await b.open({ principalId: first, workspaceId: identity.workspaceId, roomId: rooms.narrow })
            const strangers = await Promise.all(
                [second, third, identity.outsiderId].map((principalId) =>
                    b.open({ principalId, workspaceId: identity.workspaceId, roomId: rooms.narrow }),
                ),
            )
            await opened(member)
            await eachInOrder(strangers, opened)
            await a.typing.set(identity.ownerId, identity.workspaceId, rooms.narrow, true)
            await a.typing.set(identity.ownerId, identity.workspaceId, rooms.narrow, false)
            await received(member, 2)
            expect(member.frames.map((frame) => typingFrame(frame))).toEqual([
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

    it("realtime/typing-refused: a person who does not sit in the room, and a room of another workspace, cannot type", async () => {
        await withTypingReplicas(world, identity, async (a) => {
            await expect(a.typing.set(second, identity.workspaceId, rooms.narrow, true)).rejects.toMatchObject({
                code: "CHAT_TYPING_ROOM_NOT_FOUND",
            })
            await expect(
                a.typing.set(identity.outsiderId, identity.workspaceId, rooms.shared, true),
            ).rejects.toMatchObject({
                code: "CHAT_TYPING_ROOM_NOT_FOUND",
            })
            await expect(
                a.typing.set(identity.ownerId, identity.workspaceId, rooms.foreign, true),
            ).rejects.toMatchObject({
                code: "CHAT_TYPING_ROOM_NOT_FOUND",
            })
        })
    })
})

describe("chat typing SSE room isolation", () => {
    it("realtime/foreign-topic-is-isolated: a room stream excludes other rooms and workspaces through a sentinel", async () => {
        await withTypingReplicas(world, identity, async (a, b) => {
            const stream = await b.open({ principalId: first, workspaceId: identity.workspaceId, roomId: rooms.shared })
            await opened(stream)
            await a.typing.set(identity.ownerId, identity.workspaceId, rooms.narrow, true)
            await a.typing.set(identity.outsiderId, identity.foreignWorkspaceId, rooms.foreign, true)
            await a.typing.set(identity.ownerId, identity.workspaceId, rooms.shared, false)
            await received(stream, 1)
            expect(stream.frames.map((frame) => typingFrame(frame))).toEqual([
                expect.objectContaining({ actorId: identity.ownerId, actorName: "Owner", state: "stop" }),
            ])
        })
    })

    it("realtime/subscriber-receives-push: authentication is default-deny and a URL token cannot authorize the door", async () => {
        await withTypingReplicas(world, identity, async (a) => {
            await eachInOrder([undefined, `proof-${identity.ownerId}`], async (queryToken) => {
                const stream = await a.open({
                    workspaceId: identity.workspaceId,
                    roomId: rooms.shared,
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
            const principalId = third
            const initial = await a.open({ principalId, workspaceId: identity.workspaceId, roomId: rooms.shared })
            await opened(initial)
            await a.typing.set(identity.ownerId, identity.workspaceId, rooms.shared, true)
            await received(initial, 1)
            const cursor = typingFrame(initial.frames[0]).id
            await initial.disconnect()
            await waitForProof(
                () => Promise.resolve(a.hub.subscriberCount(a.topic(principalId, rooms.shared))),
                (count) => count === 0,
            )
            await a.typing.set(identity.ownerId, identity.workspaceId, rooms.shared, false)
            await a.typing.set(first, identity.workspaceId, rooms.shared, true)
            const resumed = await b.open({
                principalId,
                workspaceId: identity.workspaceId,
                roomId: rooms.shared,
                after: cursor,
            })
            await opened(resumed)
            await received(resumed, 2)
            expect(resumed.frames.map((frame) => typingFrame(frame))).toEqual([
                expect.objectContaining({ actorId: identity.ownerId, state: "stop" }),
                expect.objectContaining({ actorId: first, state: "start" }),
            ])
            expect(resumed.frames.map((frame) => frame.id)).not.toContain(cursor)
            await a.typing.set(first, identity.workspaceId, rooms.shared, false)
            await received(resumed, 3)
            expect(typingFrame(resumed.frames[2])).toMatchObject({ actorId: first, state: "stop" })
            expect(new Set(resumed.frames.map((frame) => frame.id)).size).toBe(3)
            expect(resumed.frames).toHaveLength(3)
        })
    })

    it("realtime/disconnect-releases-subscription: closing one stream releases it and leaves the other stream live", async () => {
        await withTypingReplicas(world, identity, async (a, b) => {
            const principalId = second
            const topic = b.topic(principalId, rooms.shared)
            const before = b.hub.subscriberCount(topic)
            const closing = await b.open({ principalId, workspaceId: identity.workspaceId, roomId: rooms.shared })
            const survivor = await b.open({ principalId, workspaceId: identity.workspaceId, roomId: rooms.shared })
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
            await a.typing.set(identity.ownerId, identity.workspaceId, rooms.shared, true)
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
