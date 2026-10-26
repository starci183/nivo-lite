import { AgentMessagesService } from "@modules/domain/agent-messages"
import { ChatMarkersService } from "@modules/domain/chat-markers"
import type { ChatTarget } from "@modules/domain/chat-markers"
import { TeamChatService } from "@modules/domain/messages"
import { OfficeRoomsService } from "@modules/domain/office-rooms"
import { eachInOrder } from "@modules/platform/primitives"
import {
    chatMarkersIdentity,
    persistChatMarkers,
    persistConversationMarkerLine,
    persistOfficeMarkerLine,
} from "../../fixtures/builders/chat-markers.builder"
import type { ChatMarkersIdentity } from "../../fixtures/builders/chat-markers.builder"
import {
    CHAT_MARKER_PRIVILEGES,
    DELETE_CHAT_MARKER_STATE,
    DISABLE_CHAT_READER,
    INSERT_CHAT_MARKER_STATE,
    INSERT_LEGACY_ROOM_READ,
    READ_CHAT_MARKER_CURSOR,
    READ_CHAT_MARKER_STATES,
    READ_CHAT_MESSAGE_ACTORS,
    RENAME_CHAT_READER,
    UPDATE_CHAT_MARKER_STATE,
} from "../../fixtures/persistence/chat-markers.sql"
import { CLEAN_USERS } from "../../fixtures/persistence/office-chain.sql"
import { CLEAN_WORKSPACE } from "../../fixtures/persistence/proof.sql"
import { withBackendRole } from "../../world/backend-role-proof.service"
import { ChatMarkersProofModule } from "../../world/chat-markers-proof.module"
import { OfficeRoomMembersProofModule } from "../../world/office-room-members-proof.module"
import { useTestWorld } from "../../world/use-test-world"

const world = useTestWorld({
    modules: [ChatMarkersProofModule.register(), OfficeRoomMembersProofModule.register()],
})
const OFFICE: ChatTarget = { room: null, conversationId: null }
const SALES: ChatTarget = { room: "sales", conversationId: null }
const MARKETING: ChatTarget = { room: "marketing", conversationId: null }
const FIRST = "2026-10-01T00:00:00+00:00"
const SECOND = "2026-10-01T00:01:00+00:00"
const THIRD = "2026-10-01T00:02:00+00:00"

const seed = async (): Promise<ChatMarkersIdentity> => {
    const identity = chatMarkersIdentity(() => world.id())
    world.cleanup(async () => {
        await eachInOrder([identity.workspaceId, identity.foreignWorkspaceId], async (workspaceId) => {
            await world.db.primary.query(CLEAN_WORKSPACE, [workspaceId])
        })
        await world.db.primary.query(CLEAN_USERS, [
            [identity.ownerId, ...identity.readerIds, identity.outsiderId, identity.foreignOwnerId],
        ])
    })
    await persistChatMarkers(world.db.primary, identity)
    return identity
}

const conversation = (id: string): ChatTarget => ({ room: null, conversationId: id })
const service = (): ChatMarkersService => world.resolve(ChatMarkersService)
const ownLine = (identity: ChatMarkersIdentity, id: string, at = FIRST) => ({
    id,
    authorId: identity.ownerId,
    authorName: "Shared name",
    at,
})

it("stores proven account ids through the real team and conversation writers and leaves external customers unattributed", async () => {
    const identity = await seed()
    const team = await world
        .resolve(TeamChatService)
        .postHuman(identity.ownerId, identity.workspaceId, "Team actor", "sales")
    const messages = world.resolve(AgentMessagesService)
    const test = await messages.storeCustomer(
        identity.workspaceId,
        identity.conversationIds[0],
        "Test actor",
        world.db.primary,
        identity.ownerId,
    )
    const human = await messages.storeHuman(
        identity.workspaceId,
        identity.conversationIds[1],
        "Human actor",
        "Shared name",
        world.db.primary,
        identity.ownerId,
    )
    const external = await messages.storeCustomer(
        identity.workspaceId,
        identity.conversationIds[1],
        "External customer",
        world.db.primary,
    )

    await expect(world.db.primary.query(READ_CHAT_MESSAGE_ACTORS, [[team.id, test, human, external]])).resolves.toEqual(
        [
            { id: team.id, author_user_id: identity.ownerId },
            { id: test, author_user_id: identity.ownerId },
            { id: human, author_user_id: identity.ownerId },
            { id: external, author_user_id: null },
        ].sort((left, right) => left.id.localeCompare(right.id)),
    )
    await expect(service().state(identity.ownerId, identity.workspaceId, SALES)).resolves.toMatchObject({
        lastOwnMessage: { id: team.id, status: "sent" },
    })
})

it("advances sent to delivered to seen only for another active member and reuses existing room reads", async () => {
    const identity = await seed()
    const id = world.id()
    await persistOfficeMarkerLine(world.db.primary, identity, "sales", ownLine(identity, id))
    await service().markRead(identity.ownerId, identity.workspaceId, SALES, id)
    await expect(service().state(identity.ownerId, identity.workspaceId, SALES)).resolves.toEqual({
        muted: false,
        lastOwnMessage: { id, status: "sent", seenBy: [], seenByCount: 0 },
    })
    await service().markDelivered(identity.readerIds[0], identity.workspaceId, SALES, id)
    await expect(service().state(identity.ownerId, identity.workspaceId, SALES)).resolves.toMatchObject({
        lastOwnMessage: { id, status: "delivered", seenByCount: 0 },
    })
    await world.db.primary.query(INSERT_LEGACY_ROOM_READ, [identity.workspaceId, identity.readerIds[1], "sales", FIRST])
    await expect(service().state(identity.ownerId, identity.workspaceId, SALES)).resolves.toMatchObject({
        lastOwnMessage: {
            id,
            status: "seen",
            seenBy: [{ id: identity.readerIds[1], name: "Reader 2", avatarSeed: identity.readerIds[1] }],
            seenByCount: 1,
        },
    })
    await world.db.primary.query(DISABLE_CHAT_READER, [identity.workspaceId, identity.readerIds[1]])
    await expect(service().state(identity.ownerId, identity.workspaceId, SALES)).resolves.toMatchObject({
        lastOwnMessage: { id, status: "delivered", seenBy: [], seenByCount: 0 },
    })
})

it("selects the latest own message by stable account id despite name collisions and newer legacy or other messages", async () => {
    const identity = await seed()
    const own = world.id()
    await persistOfficeMarkerLine(world.db.primary, identity, "sales", ownLine(identity, own))
    await persistOfficeMarkerLine(world.db.primary, identity, "sales", {
        id: world.id(),
        authorId: identity.readerIds[0],
        authorName: "Shared name",
        at: SECOND,
    })
    await persistOfficeMarkerLine(world.db.primary, identity, "sales", {
        id: world.id(),
        authorId: null,
        authorName: "Shared name",
        at: THIRD,
    })
    await expect(service().state(identity.ownerId, identity.workspaceId, SALES)).resolves.toMatchObject({
        lastOwnMessage: { id: own },
    })
    await expect(service().state(identity.readerIds[1], identity.workspaceId, SALES)).resolves.toEqual({
        muted: false,
        lastOwnMessage: null,
    })
})

it("keeps aggregate Office acknowledgements separate from department receipts and unread counts", async () => {
    const identity = await seed()
    const salesId = world.id()
    const marketingId = world.id()
    await persistOfficeMarkerLine(world.db.primary, identity, "sales", ownLine(identity, salesId))
    await persistOfficeMarkerLine(world.db.primary, identity, "marketing", ownLine(identity, marketingId, SECOND))
    const reader = identity.readerIds[0]
    const unread = async () =>
        (await world.resolve(OfficeRoomsService).rooms(reader, identity.workspaceId)).map(({ key, unread }) => ({
            key,
            unread,
        }))
    const allUnread = [
        { key: null, unread: 2 },
        { key: "marketing", unread: 1 },
        { key: "sales", unread: 1 },
    ]
    await expect(unread()).resolves.toEqual(allUnread)
    await service().markDelivered(reader, identity.workspaceId, OFFICE, marketingId)
    await expect(service().state(identity.ownerId, identity.workspaceId, OFFICE)).resolves.toMatchObject({
        lastOwnMessage: { id: marketingId, status: "delivered", seenByCount: 0 },
    })
    await expect(unread()).resolves.toEqual(allUnread)
    await expect(service().state(identity.ownerId, identity.workspaceId, SALES)).resolves.toMatchObject({
        lastOwnMessage: { id: salesId, status: "sent", seenByCount: 0 },
    })
    await service().markRead(reader, identity.workspaceId, OFFICE, marketingId)
    await expect(service().state(identity.ownerId, identity.workspaceId, OFFICE)).resolves.toMatchObject({
        lastOwnMessage: { id: marketingId, status: "seen", seenByCount: 1 },
    })
    await expect(service().state(identity.ownerId, identity.workspaceId, SALES)).resolves.toMatchObject({
        lastOwnMessage: { id: salesId, status: "sent", seenByCount: 0 },
    })
    await expect(service().state(identity.ownerId, identity.workspaceId, MARKETING)).resolves.toMatchObject({
        lastOwnMessage: { id: marketingId, status: "sent", seenByCount: 0 },
    })
    await expect(unread()).resolves.toEqual([
        { key: null, unread: 0 },
        { key: "marketing", unread: 1 },
        { key: "sales", unread: 1 },
    ])
    await service().markDelivered(reader, identity.workspaceId, SALES, salesId)
    await expect(service().state(identity.ownerId, identity.workspaceId, SALES)).resolves.toMatchObject({
        lastOwnMessage: { id: salesId, status: "delivered", seenByCount: 0 },
    })
    await expect(unread()).resolves.toEqual([
        { key: null, unread: 0 },
        { key: "marketing", unread: 1 },
        { key: "sales", unread: 1 },
    ])
    await service().markRead(reader, identity.workspaceId, SALES, salesId)
    await expect(service().state(identity.ownerId, identity.workspaceId, SALES)).resolves.toMatchObject({
        lastOwnMessage: { id: salesId, status: "seen", seenByCount: 1 },
    })
    await expect(unread()).resolves.toEqual([
        { key: null, unread: 0 },
        { key: "marketing", unread: 1 },
        { key: "sales", unread: 0 },
    ])
})

it("does not acknowledge the aggregate Office target when a department is delivered or read", async () => {
    const identity = await seed()
    const id = world.id()
    const reader = identity.readerIds[0]
    await persistOfficeMarkerLine(world.db.primary, identity, "sales", ownLine(identity, id))
    await service().markDelivered(reader, identity.workspaceId, SALES, id)
    await expect(service().state(identity.ownerId, identity.workspaceId, OFFICE)).resolves.toMatchObject({
        lastOwnMessage: { id, status: "sent", seenByCount: 0 },
    })
    await service().markRead(reader, identity.workspaceId, SALES, id)
    await expect(service().state(identity.ownerId, identity.workspaceId, OFFICE)).resolves.toMatchObject({
        lastOwnMessage: { id, status: "sent", seenByCount: 0 },
    })
    const rooms = await world.resolve(OfficeRoomsService).rooms(reader, identity.workspaceId)
    expect(rooms.map(({ key, unread }) => ({ key, unread }))).toEqual([
        { key: null, unread: 1 },
        { key: "marketing", unread: 0 },
        { key: "sales", unread: 0 },
    ])
})

it.each([OFFICE, SALES])(
    "does not mark a later UUID at the same creation instant seen in target %p",
    async (target) => {
        const identity = await seed()
        const fetched = world.id()
        const newer = world.id()
        await persistOfficeMarkerLine(world.db.primary, identity, "sales", ownLine(identity, fetched))
        await service().markRead(identity.readerIds[0], identity.workspaceId, target, fetched)
        await persistOfficeMarkerLine(world.db.primary, identity, "sales", ownLine(identity, newer))

        await expect(service().state(identity.ownerId, identity.workspaceId, target)).resolves.toMatchObject({
            lastOwnMessage: { id: newer, status: "sent", seenByCount: 0 },
        })
        await service().markRead(identity.readerIds[0], identity.workspaceId, target, newer)
        await service().markRead(identity.readerIds[0], identity.workspaceId, target, fetched)
        await expect(service().state(identity.ownerId, identity.workspaceId, target)).resolves.toMatchObject({
            lastOwnMessage: { id: newer, status: "seen", seenByCount: 1 },
        })
        await expect(
            world.db.primary.query(READ_CHAT_MARKER_CURSOR, [
                identity.workspaceId,
                identity.readerIds[0],
                target.room ?? "",
            ]),
        ).resolves.toEqual([{ delivered_message_id: newer, read_message_id: newer }])
    },
)

it("bounds reader avatars at three while counting all active readers and using their current workspace names", async () => {
    const identity = await seed()
    const id = world.id()
    await persistOfficeMarkerLine(world.db.primary, identity, "sales", ownLine(identity, id))
    await eachInOrder(identity.readerIds, async (userId) => {
        await world.db.primary.query(INSERT_LEGACY_ROOM_READ, [identity.workspaceId, userId, "sales", FIRST])
    })
    await world.db.primary.query(RENAME_CHAT_READER, [identity.workspaceId, identity.readerIds[0], "Renamed reader"])

    await expect(service().state(identity.ownerId, identity.workspaceId, SALES)).resolves.toEqual({
        muted: false,
        lastOwnMessage: {
            id,
            status: "seen",
            seenBy: [
                { id: identity.readerIds[0], name: "Renamed reader", avatarSeed: identity.readerIds[0] },
                { id: identity.readerIds[1], name: "Reader 2", avatarSeed: identity.readerIds[1] },
                { id: identity.readerIds[2], name: "Reader 3", avatarSeed: identity.readerIds[2] },
            ],
            seenByCount: 4,
        },
    })
})
it.each([0, 1] as const)(
    "uses message cursors for test/customer conversation %p without future acknowledgement or regression",
    async (index) => {
        const identity = await seed()
        const target = conversation(identity.conversationIds[index])
        const first = world.id()
        const second = world.id()
        const newer = world.id()
        await persistConversationMarkerLine(
            world.db.primary,
            identity,
            target.conversationId ?? "",
            ownLine(identity, first),
        )
        await service().markDelivered(identity.readerIds[0], identity.workspaceId, target, first)
        await persistConversationMarkerLine(
            world.db.primary,
            identity,
            target.conversationId ?? "",
            ownLine(identity, second, SECOND),
        )
        await expect(service().state(identity.ownerId, identity.workspaceId, target)).resolves.toMatchObject({
            lastOwnMessage: { id: second, status: "sent" },
        })
        await persistConversationMarkerLine(
            world.db.primary,
            identity,
            target.conversationId ?? "",
            ownLine(identity, newer, SECOND),
        )
        await service().markRead(identity.readerIds[0], identity.workspaceId, target, second)
        await expect(service().state(identity.ownerId, identity.workspaceId, target)).resolves.toMatchObject({
            lastOwnMessage: { id: newer, status: "sent", seenByCount: 0 },
        })
        await service().markRead(identity.readerIds[0], identity.workspaceId, target, newer)
        await service().markRead(identity.readerIds[0], identity.workspaceId, target, first)
        await service().markDelivered(identity.readerIds[0], identity.workspaceId, target, second)
        await expect(service().state(identity.ownerId, identity.workspaceId, target)).resolves.toMatchObject({
            lastOwnMessage: { id: newer, status: "seen", seenByCount: 1 },
        })
        await expect(
            world.db.primary.query(READ_CHAT_MARKER_CURSOR, [
                identity.workspaceId,
                identity.readerIds[0],
                target.conversationId,
            ]),
        ).resolves.toEqual([{ delivered_message_id: newer, read_message_id: newer }])
    },
)

it("keeps mute preferences per caller and target without changing persisted receipts", async () => {
    const identity = await seed()
    const target = conversation(identity.conversationIds[0])
    const id = world.id()
    await persistConversationMarkerLine(world.db.primary, identity, identity.conversationIds[0], ownLine(identity, id))
    await service().markDelivered(identity.readerIds[0], identity.workspaceId, target, id)
    await service().mute(identity.ownerId, identity.workspaceId, target, true)
    await expect(service().state(identity.ownerId, identity.workspaceId, target)).resolves.toMatchObject({
        muted: true,
        lastOwnMessage: { id, status: "delivered" },
    })
    await expect(service().state(identity.readerIds[0], identity.workspaceId, target)).resolves.toMatchObject({
        muted: false,
    })
    await expect(service().state(identity.ownerId, identity.workspaceId, SALES)).resolves.toMatchObject({
        muted: false,
    })
    await service().mute(identity.ownerId, identity.workspaceId, target, false)
    await service().mute(identity.ownerId, identity.workspaceId, SALES, true)
    await expect(service().state(identity.ownerId, identity.workspaceId, target)).resolves.toMatchObject({
        muted: false,
    })
    await expect(service().state(identity.ownerId, identity.workspaceId, SALES)).resolves.toMatchObject({
        muted: true,
    })
})

it("refuses disabled/nonmembers, foreign targets and messages outside their selected room, conversation or workspace", async () => {
    const identity = await seed()
    const roomMessage = world.id()
    const conversationMessage = world.id()
    const foreignMessage = world.id()
    await persistOfficeMarkerLine(world.db.primary, identity, "sales", ownLine(identity, roomMessage))
    await persistConversationMarkerLine(
        world.db.primary,
        identity,
        identity.conversationIds[0],
        ownLine(identity, conversationMessage),
    )
    await persistConversationMarkerLine(world.db.primary, identity, identity.conversationIds[2], {
        ...ownLine(identity, foreignMessage),
        authorId: identity.foreignOwnerId,
    })
    await eachInOrder([identity.readerIds[4], identity.outsiderId, identity.foreignOwnerId], async (caller) => {
        await expect(service().state(caller, identity.workspaceId, SALES)).rejects.toMatchObject({
            code: "WORKSPACE_MEMBERS_NOT_MEMBER",
        })
        await expect(service().mute(caller, identity.workspaceId, SALES, true)).rejects.toMatchObject({
            code: "WORKSPACE_MEMBERS_NOT_MEMBER",
        })
    })
    await expect(
        service().state(identity.ownerId, identity.workspaceId, conversation(identity.conversationIds[2])),
    ).rejects.toMatchObject({ code: "CHAT_MARKERS_TARGET_NOT_FOUND" })
    await expect(
        service().state(identity.ownerId, identity.workspaceId, {
            room: "sales",
            conversationId: identity.conversationIds[0],
        }),
    ).rejects.toMatchObject({ code: "CHAT_MARKERS_TARGET_NOT_FOUND" })
    await expect(
        service().markDelivered(identity.ownerId, identity.workspaceId, MARKETING, roomMessage),
    ).rejects.toMatchObject({ code: "CHAT_MARKERS_MESSAGE_NOT_FOUND" })
    await expect(
        service().markRead(
            identity.ownerId,
            identity.workspaceId,
            conversation(identity.conversationIds[1]),
            conversationMessage,
        ),
    ).rejects.toMatchObject({ code: "CHAT_MARKERS_MESSAGE_NOT_FOUND" })
    await expect(
        service().markDelivered(
            identity.ownerId,
            identity.workspaceId,
            conversation(identity.conversationIds[0]),
            foreignMessage,
        ),
    ).rejects.toMatchObject({ code: "CHAT_MARKERS_MESSAGE_NOT_FOUND" })
})
it("grants CRUD only to the backend and applies all policies to valid persisted preferences", async () => {
    const identity = await seed()
    await expect(world.db.primary.query(CHAT_MARKER_PRIVILEGES)).resolves.toEqual([
        { rls: true, backend: true, anonymous: false, browser: false },
    ])
    await withBackendRole(world, async (tx) => {
        await tx.query(INSERT_CHAT_MARKER_STATE, [identity.workspaceId, identity.ownerId, "sales", null])
        await expect(tx.query(READ_CHAT_MARKER_STATES, [identity.workspaceId])).resolves.toEqual([
            { user_id: identity.ownerId, room: "sales", conversation_id: null, muted: true },
        ])
        await tx.query(UPDATE_CHAT_MARKER_STATE, [identity.workspaceId, identity.ownerId])
        await expect(tx.query(READ_CHAT_MARKER_STATES, [identity.workspaceId])).resolves.toEqual([
            { user_id: identity.ownerId, room: "sales", conversation_id: null, muted: false },
        ])
        await tx.query(DELETE_CHAT_MARKER_STATE, [identity.workspaceId, identity.ownerId])
        await expect(tx.query(READ_CHAT_MARKER_STATES, [identity.workspaceId])).resolves.toEqual([])
    })
})

it("hides disabled member rows and denies writes for disabled people or foreign conversations", async () => {
    const identity = await seed()
    await world.db.primary.query(INSERT_CHAT_MARKER_STATE, [identity.workspaceId, identity.readerIds[4], "sales", null])
    await withBackendRole(world, async (tx) => {
        await expect(tx.query(READ_CHAT_MARKER_STATES, [identity.workspaceId])).resolves.toEqual([])
        await expect(
            tx.query(INSERT_CHAT_MARKER_STATE, [identity.workspaceId, identity.readerIds[4], "marketing", null]),
        ).rejects.toThrow("row-level security")
    })
    await withBackendRole(world, async (tx) => {
        await expect(
            tx.query(INSERT_CHAT_MARKER_STATE, [
                identity.workspaceId,
                identity.ownerId,
                "",
                identity.conversationIds[2],
            ]),
        ).rejects.toThrow("row-level security")
    })
})
