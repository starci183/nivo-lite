import { ChatTypingService } from "@modules/domain/chat-typing"
import { REALTIME_HUB } from "@modules/platform/realtime"
import type { RealtimeHub, RealtimeTopic } from "@modules/platform/realtime"
import { eachInOrder } from "@modules/platform/primitives"
import { chatMarkersIdentity, persistChatMarkers } from "../../fixtures/builders/chat-markers.builder"
import {
    CLEAN_TYPING_BROADCASTS,
    INSERT_SPOOFED_TYPING_BROADCAST,
    PUBLISH_TYPING_BROADCAST,
    READ_TYPING_BROADCASTS,
    RETURN_TYPING_PROOF_ROLE,
    TYPING_BROADCAST_PRIVILEGES,
    TYPING_TOPIC_MEMBER,
    TYPING_TOPIC_MEMBER_AS,
} from "../../fixtures/persistence/chat-typing.sql"
import { CLEAN_USERS } from "../../fixtures/persistence/office-chain.sql"
import { CLEAN_WORKSPACE } from "../../fixtures/persistence/proof.sql"
import { withBackendRole } from "../../world/backend-role-proof.service"
import { ChatTypingProofModule } from "../../world/chat-typing-proof.module"
import { withTypingReceiver } from "../../world/chat-typing-proof.service"
import { useTestWorld } from "../../world/use-test-world"

const world = useTestWorld({ modules: [ChatTypingProofModule.register()] })
const identity = chatMarkersIdentity(() => world.id())
const OFFICE = { room: null, conversationId: null }
/** What a member receives: the typing frames published to their own copy of the Office topic. */
const receiverTopic = (recipientId: string): RealtimeTopic<object> => ({
    name: `chat-typing:${recipientId}:${identity.workspaceId}:room:office`,
    accepts: (frame: unknown): frame is object => typeof frame === "object" && frame !== null,
})
const roomTopic = (room: string) => `chat-typing:${identity.workspaceId}:room:${room}`
const conversationTopic = (id: string) => `chat-typing:${identity.workspaceId}:conversation:${id}`

/** What the existing Supabase broadcast function actually persisted for realtime transport. */
interface TypingBroadcastRow {
    /** The backend-authored identity and deadline. */
    readonly payload: Readonly<Record<string, unknown>>
    /** The application event. */
    readonly event: string
    /** Signals never use a public channel. */
    readonly private: boolean
    /** Signals are broadcasts, not browser presence updates. */
    readonly extension: string
}

beforeAll(async () => {
    world.cleanup(async () => {
        await world.db.primary.query(CLEAN_TYPING_BROADCASTS, [identity.workspaceId])
        await eachInOrder([identity.workspaceId, identity.foreignWorkspaceId], async (workspaceId) => {
            await world.db.primary.query(CLEAN_WORKSPACE, [workspaceId])
        })
        await world.db.primary.query(CLEAN_USERS, [
            [identity.ownerId, ...identity.readerIds, identity.outsiderId, identity.foreignOwnerId],
        ])
    })
    await persistChatMarkers(world.db.primary, identity)
})

describe("chat typing private broadcast over PostgreSQL", () => {
    it("publishes only the admitted sender's identity, with a five-second start deadline and immediate stop", async () => {
        const typing = world.resolve(ChatTypingService)
        const channel = await typing.channel(identity.ownerId, identity.workspaceId.toUpperCase(), OFFICE)
        const frames = world
            .resolve<RealtimeHub>(REALTIME_HUB)
            .subscribe(receiverTopic(identity.readerIds[0]))
            [Symbol.asyncIterator]()
        const started = await typing.set(identity.ownerId, identity.workspaceId, OFFICE, true)
        const stopped = await typing.set(identity.ownerId, identity.workspaceId, OFFICE, false)
        const first = await frames.next()
        const second = await frames.next()
        await frames.return?.()

        expect(channel).toEqual({ topic: roomTopic("office"), event: "typing", private: true, ttlMs: 5000 })
        expect(started).toMatchObject({
            id: identity.ownerId,
            name: "Shared name",
            avatarSeed: identity.ownerId,
            typing: true,
        })
        expect(new Date(started.expiresAt).toISOString()).toBe(started.expiresAt)
        expect(new Date(stopped.expiresAt).toISOString()).toBe(stopped.expiresAt)
        expect(stopped.typing).toBe(false)
        expect([first.value, second.value]).toEqual([
            expect.objectContaining({ actorId: identity.ownerId, actorName: "Shared name", state: "start" }),
            expect.objectContaining({ actorId: identity.ownerId, actorName: "Shared name", state: "stop" }),
        ])
    })

    it("separates department, agent and customer topics and rejects foreign, disabled and absent members", async () => {
        const typing = world.resolve(ChatTypingService)
        const department = await typing.channel(identity.readerIds[0], identity.workspaceId, {
            room: "sales",
            conversationId: null,
        })
        expect(department.topic).toBe(roomTopic("sales"))
        await eachInOrder(identity.conversationIds.slice(0, 2), async (conversationId) => {
            const channel = await typing.channel(identity.ownerId, identity.workspaceId, {
                room: null,
                conversationId: conversationId.toUpperCase(),
            })
            expect(channel.topic).toBe(conversationTopic(conversationId))
        })
        await expect(
            typing.set(
                identity.ownerId,
                identity.workspaceId,
                { room: null, conversationId: identity.conversationIds[2] },
                true,
            ),
        ).rejects.toMatchObject({ code: "CHAT_MARKERS_TARGET_NOT_FOUND" })
        await eachInOrder([identity.outsiderId, identity.readerIds[4], identity.foreignOwnerId], async (userId) => {
            await expect(typing.channel(userId, identity.workspaceId, OFFICE)).rejects.toMatchObject({
                code: "WORKSPACE_MEMBERS_NOT_MEMBER",
            })
        })
    })

    it("lets the actual backend publish private broadcasts while denying browser and anonymous wrapper execution", async () => {
        await expect(world.db.primary.query(TYPING_BROADCAST_PRIVILEGES)).resolves.toEqual([
            { backend: true, browser: false, anonymous: false },
        ])
        await withBackendRole(world, async (tx) => {
            const payload = { id: identity.ownerId, typing: true }
            await tx.query(PUBLISH_TYPING_BROADCAST, [roomTopic("sales"), JSON.stringify(payload)])
            await tx.query(RETURN_TYPING_PROOF_ROLE)
            await expect(tx.query(READ_TYPING_BROADCASTS, [roomTopic("sales")])).resolves.toEqual([
                { payload, event: "typing", private: true, extension: "broadcast" },
            ])
        })
        await withTypingReceiver(world, identity.ownerId, roomTopic("sales"), async (tx) => {
            await expect(tx.query(PUBLISH_TYPING_BROADCAST, [roomTopic("sales"), "{}"])).rejects.toMatchObject({
                code: "42501",
            })
        })
    })
})

describe("chat typing receive RLS", () => {
    it("admits only active workspace members for their existing target and does not expose another topic's payload", async () => {
        const topic = roomTopic("marketing")
        await world.resolve(ChatTypingService).set(
            identity.ownerId,
            identity.workspaceId,
            {
                room: "marketing",
                conversationId: null,
            },
            true,
        )
        await withTypingReceiver(world, identity.readerIds[0], topic, async (tx) => {
            await expect(tx.query(TYPING_TOPIC_MEMBER, [topic])).resolves.toEqual([{ allowed: true }])
            await expect(tx.query(TYPING_TOPIC_MEMBER_AS, [topic, identity.ownerId])).resolves.toEqual([
                { allowed: false },
            ])
            const own = await tx.query<Array<TypingBroadcastRow>>(READ_TYPING_BROADCASTS, [topic])
            expect(own).toHaveLength(1)
            await expect(tx.query(READ_TYPING_BROADCASTS, [roomTopic("sales")])).resolves.toEqual([])
        })
        await eachInOrder([identity.readerIds[4], identity.outsiderId, identity.foreignOwnerId], async (userId) => {
            await withTypingReceiver(world, userId, topic, async (tx) => {
                await expect(tx.query(TYPING_TOPIC_MEMBER, [topic])).resolves.toEqual([{ allowed: false }])
                await expect(tx.query(READ_TYPING_BROADCASTS, [topic])).resolves.toEqual([])
            })
        })
        await withTypingReceiver(
            world,
            identity.ownerId,
            conversationTopic(identity.conversationIds[2]),
            async (tx) => {
                await expect(
                    tx.query(TYPING_TOPIC_MEMBER, [conversationTopic(identity.conversationIds[2])]),
                ).resolves.toEqual([{ allowed: false }])
            },
        )
    })

    it("safely rejects malformed, nonexistent, wrong-kind and cross-workspace topics", async () => {
        const malformed = [
            "chat-typing:bad:room:office",
            "chat-typing",
            "",
            `chat-typing:${identity.workspaceId}:conversation:bad`,
            `chat-typing:${identity.workspaceId}:unknown:office`,
            roomTopic("unknown"),
            `chat-typing:${identity.foreignWorkspaceId}:room:office`,
        ]
        await withTypingReceiver(world, identity.ownerId, roomTopic("office"), async (tx) => {
            await eachInOrder(malformed, async (topic) => {
                await expect(tx.query(TYPING_TOPIC_MEMBER, [topic])).resolves.toEqual([{ allowed: false }])
            })
            await expect(tx.query(TYPING_TOPIC_MEMBER, [null])).resolves.toEqual([{ allowed: false }])
        })
    })

    it("has no browser insert policy, preventing clients from forging another member's typing identity", async () => {
        await withTypingReceiver(world, identity.ownerId, roomTopic("office"), async (tx) => {
            await expect(tx.query(INSERT_SPOOFED_TYPING_BROADCAST, [roomTopic("office")])).rejects.toMatchObject({
                code: "42501",
            })
        })
    })
})
