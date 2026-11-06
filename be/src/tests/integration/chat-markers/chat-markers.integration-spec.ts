import { ChatMarkersService } from "@modules/domain/chat-markers"
import type { ChatTarget } from "@modules/domain/chat-markers"
import { TeamChatService } from "@modules/domain/messages"
import { OfficeRoomsService } from "@modules/domain/office-rooms"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { eachInOrder } from "@modules/platform/primitives"
import {
    chatMarkersIdentity,
    persistChatMarkers,
    persistOfficeMarkerLine,
    insertChatMarkerState,
    insertLegacyRoomRead,
} from "../../fixtures/builders/chat-markers.builder"
import type { ChatMarkersIdentity } from "../../fixtures/builders/chat-markers.builder"
import {
    chatMarkerCursor,
    chatMarkerPrivileges,
    chatMessageActors,
    deleteChatMarkerState,
    disableChatReader,
    readChatMarkerStates,
    renameChatReader,
    unmuteChatMarkerState,
} from "../../world/chat-markers-database.service"
import { removeAuthUsers, removeWorkspace, storeUploadedAvatar } from "../../world/proof-accounts.service"
import { withBackendRole } from "../../world/backend-role-proof.service"
import { ChatMarkersProofModule } from "../../world/chat-markers-proof.module"
import { OfficeRoomMembersProofModule } from "../../world/office-room-members-proof.module"
import { useTestWorld } from "../../world/use-test-world"

const world = useTestWorld({
    modules: [ChatMarkersProofModule.register(), OfficeRoomMembersProofModule.register()],
})
const OFFICE: ChatTarget = { room: null }
const SALES: ChatTarget = { room: "sales" }
const MARKETING: ChatTarget = { room: "marketing" }
const FIRST = "2026-10-01T00:00:00+00:00"
const SECOND = "2026-10-01T00:01:00+00:00"
const THIRD = "2026-10-01T00:02:00+00:00"

const seed = async (): Promise<ChatMarkersIdentity> => {
    const identity = chatMarkersIdentity(() => world.id())
    world.cleanup(async () => {
        await eachInOrder([identity.workspaceId, identity.foreignWorkspaceId], async (workspaceId) => {
            await removeWorkspace(world.db.primary, workspaceId)
        })
        await removeAuthUsers(world.db.primary, [
            identity.ownerId,
            ...identity.readerIds,
            identity.outsiderId,
            identity.foreignOwnerId,
        ])
    })
    await persistChatMarkers(world.db.primary, identity)
    return identity
}

const service = (): ChatMarkersService => world.resolve(ChatMarkersService)
const ownLine = (identity: ChatMarkersIdentity, id: string, at = FIRST) => ({
    id,
    authorId: identity.ownerId,
    authorName: "Shared name",
    at,
})

it("stores the proven account id through the real team writer", async () => {
    const identity = await seed()
    const team = await world
        .resolve(TeamChatService)
        .postHuman(identity.ownerId, identity.workspaceId, "Team actor", "sales")

    await expect(chatMessageActors(world.db.primary, [team.id])).resolves.toEqual([
        { id: team.id, author_user_id: identity.ownerId },
    ])
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
    await insertLegacyRoomRead(world.db.primary, identity.workspaceId, identity.readerIds[1], "sales", FIRST)
    await expect(service().state(identity.ownerId, identity.workspaceId, SALES)).resolves.toMatchObject({
        lastOwnMessage: {
            id,
            status: "seen",
            seenBy: [{ id: identity.readerIds[1], name: "Reader 2", avatarSeed: identity.readerIds[1] }],
            seenByCount: 1,
        },
    })
    await disableChatReader(world.db.primary, identity.workspaceId, identity.readerIds[1])
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
            chatMarkerCursor(world.db.primary, identity.workspaceId, identity.readerIds[0], target.room ?? ""),
        ).resolves.toEqual([{ delivered_message_id: newer, read_message_id: newer }])
    },
)

it("bounds reader avatars at three while using current names and uploaded pictures in receipts and the member directory", async () => {
    const identity = await seed()
    const id = world.id()
    const avatarUrl = "https://cdn.example.test/reader.png"
    await persistOfficeMarkerLine(world.db.primary, identity, "sales", ownLine(identity, id))
    await eachInOrder(identity.readerIds, async (userId) => {
        await insertLegacyRoomRead(world.db.primary, identity.workspaceId, userId, "sales", FIRST)
    })
    await renameChatReader(world.db.primary, identity.workspaceId, identity.readerIds[0], "Renamed reader")
    await storeUploadedAvatar(world.db.primary, identity.readerIds[0], avatarUrl)

    await expect(service().state(identity.ownerId, identity.workspaceId, SALES)).resolves.toEqual({
        muted: false,
        lastOwnMessage: {
            id,
            status: "seen",
            seenBy: [
                { id: identity.readerIds[0], name: "Renamed reader", avatarSeed: identity.readerIds[0], avatarUrl },
                { id: identity.readerIds[1], name: "Reader 2", avatarSeed: identity.readerIds[1], avatarUrl: null },
                { id: identity.readerIds[2], name: "Reader 3", avatarSeed: identity.readerIds[2], avatarUrl: null },
            ],
            seenByCount: 4,
        },
    })
    await expect(
        world.resolve(WorkspaceMembersService).list(identity.readerIds[1], identity.workspaceId),
    ).resolves.toEqual(
        expect.arrayContaining([
            expect.objectContaining({ userId: identity.readerIds[0], avatarUrl, email: "", lastSignInAt: null }),
        ]),
    )
})
it.each([SALES, OFFICE])(
    "uses message cursors for the room %p without future acknowledgement or regression",
    async (target) => {
        const identity = await seed()
        const first = world.id()
        const second = world.id()
        const newer = world.id()
        await persistOfficeMarkerLine(world.db.primary, identity, target.room, ownLine(identity, first))
        await service().markDelivered(identity.readerIds[0], identity.workspaceId, target, first)
        await persistOfficeMarkerLine(world.db.primary, identity, target.room, ownLine(identity, second, SECOND))
        await expect(service().state(identity.ownerId, identity.workspaceId, target)).resolves.toMatchObject({
            lastOwnMessage: { id: second, status: "sent" },
        })
        await persistOfficeMarkerLine(world.db.primary, identity, target.room, ownLine(identity, newer, SECOND))
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
            chatMarkerCursor(world.db.primary, identity.workspaceId, identity.readerIds[0], target.room ?? ""),
        ).resolves.toEqual([{ delivered_message_id: newer, read_message_id: newer }])
    },
)

it("keeps mute preferences per caller and target without changing persisted receipts", async () => {
    const identity = await seed()
    const target = MARKETING
    const id = world.id()
    await persistOfficeMarkerLine(world.db.primary, identity, "marketing", ownLine(identity, id))
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

it("refuses disabled/nonmembers, unknown rooms and messages outside their selected room", async () => {
    const identity = await seed()
    const roomMessage = world.id()
    await persistOfficeMarkerLine(world.db.primary, identity, "sales", ownLine(identity, roomMessage))
    await eachInOrder([identity.readerIds[4], identity.outsiderId, identity.foreignOwnerId], async (caller) => {
        await expect(service().state(caller, identity.workspaceId, SALES)).rejects.toMatchObject({
            code: "WORKSPACE_MEMBERS_NOT_MEMBER",
        })
        await expect(service().mute(caller, identity.workspaceId, SALES, true)).rejects.toMatchObject({
            code: "WORKSPACE_MEMBERS_NOT_MEMBER",
        })
    })
    await expect(service().state(identity.ownerId, identity.workspaceId, { room: "accounting" })).rejects.toMatchObject(
        { code: "CHAT_MARKERS_TARGET_NOT_FOUND" },
    )
    await expect(
        service().markDelivered(identity.ownerId, identity.workspaceId, MARKETING, roomMessage),
    ).rejects.toMatchObject({ code: "CHAT_MARKERS_MESSAGE_NOT_FOUND" })
})
it("grants CRUD only to the backend and applies all policies to valid persisted preferences", async () => {
    const identity = await seed()
    await expect(chatMarkerPrivileges(world.db.primary)).resolves.toEqual([
        { rls: true, backend: true, anonymous: false, browser: false },
    ])
    await withBackendRole(world, async (tx) => {
        await insertChatMarkerState(tx, identity.workspaceId, identity.ownerId, "sales")
        await expect(readChatMarkerStates(tx, identity.workspaceId)).resolves.toEqual([
            { user_id: identity.ownerId, room: "sales", muted: true },
        ])
        await unmuteChatMarkerState(tx, identity.workspaceId, identity.ownerId)
        await expect(readChatMarkerStates(tx, identity.workspaceId)).resolves.toEqual([
            { user_id: identity.ownerId, room: "sales", muted: false },
        ])
        await deleteChatMarkerState(tx, identity.workspaceId, identity.ownerId)
        await expect(readChatMarkerStates(tx, identity.workspaceId)).resolves.toEqual([])
    })
})

it("hides disabled member rows and denies writes for disabled people", async () => {
    const identity = await seed()
    await insertChatMarkerState(world.db.primary, identity.workspaceId, identity.readerIds[4], "sales")
    await withBackendRole(world, async (tx) => {
        await expect(readChatMarkerStates(tx, identity.workspaceId)).resolves.toEqual([])
        await expect(
            insertChatMarkerState(tx, identity.workspaceId, identity.readerIds[4], "marketing"),
        ).rejects.toThrow("row-level security")
    })
})
