import { Test } from "@nestjs/testing"
import { builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { ChatActivityService } from "@modules/domain/chat-activity"
import { WorkspaceMembersService, WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import type { ActiveUserRecord } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { OfficeReadMarkersService } from "@modules/domain/office-rooms"
import type { ChatTarget } from "./chat-markers.contracts"
import { ChatMarkersService } from "./chat-markers.service"
import { ChatMarkerEntity } from "./persistence/entities"
import type { FakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import { AgentMessageCursorsService } from "@modules/domain/agent-messages"
import { MessageCursorsService } from "@modules/domain/messages"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"

const member = builder<WorkspaceMember>({
    userId: "member",
    workspaceId: "workspace",
    role: "staff",
    staffId: null,
    displayName: "Member",
    status: "active",
})
const OFFICE: ChatTarget = { room: null, conversationId: null }
const SALES: ChatTarget = { room: "sales", conversationId: null }
const CONVERSATION: ChatTarget = { room: null, conversationId: "conversation" }
const PERSISTED_AT = "2026-10-25T01:00:00+00:00"
/** The statements `callDbFunction` sends for the admission predicate and the avatar function. */
const CHAT_TARGET_MEMBER = "SELECT * FROM be_access.chat_target_member($1, $2, $3, $4)"
const CHAT_READER_AVATARS = "SELECT * FROM be_access.workspace_member_avatars($1, $2)"

/** The caller and one other active member, the roster most receipts weigh. */
const ME: ActiveUserRecord = { userId: "member", displayName: "Me" }
const READER: ActiveUserRecord = { userId: "reader", displayName: "Reader" }

/** What the message cursor reads answer: the caller's newest message and the instant of a fetched one. */
interface Cursors {
    readonly own?: { readonly id: string; readonly createdAt: string } | null
    readonly created?: string | null
}

const build = async (em: MockEntityManager, roster: ReadonlyArray<ActiveUserRecord> = [], cursors: Cursors = {}) => {
    const rooms = mock<MessageCursorsService>()
    rooms.newestAuthored.mockResolvedValue(cursors.own ?? null)
    rooms.createdAtOf.mockResolvedValue(cursors.created ?? null)
    const conversations = mock<AgentMessageCursorsService>()
    conversations.newestAuthored.mockResolvedValue(cursors.own ?? null)
    conversations.createdAtOf.mockResolvedValue(cursors.created ?? null)
    const tx = fakeTransaction(em)
    const seats = mock<WorkspaceMemberSeatsService>()
    seats.activeUsers.mockResolvedValue([...roster])
    const members = mock<WorkspaceMembersService>({ require: jest.fn().mockResolvedValue(member()) })
    const roomReads = mock<OfficeReadMarkersService>({ advance: jest.fn().mockResolvedValue(undefined) })
    const activity = mock<ChatActivityService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChatMarkersService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: OfficeReadMarkersService, useValue: roomReads },
            { provide: ChatActivityService, useValue: activity },
            { provide: WorkspaceMemberSeatsService, useValue: seats },
            { provide: MessageCursorsService, useValue: rooms },
            { provide: AgentMessageCursorsService, useValue: conversations },
        ],
    }).compile()
    return { service: moduleRef.get(ChatMarkersService), members, roomReads, tx, activity, seats, rooms, conversations }
}

describe("ChatMarkersService admission", () => {
    it.each([OFFICE, SALES, CONVERSATION])("proves active membership and target scope for %p", async (target) => {
        const em = mockEntityManager({ query: [CHAT_TARGET_MEMBER, [{ chat_target_member: true }]] })
        const { service, members } = await build(em)

        await expect(service.requireTarget("principal", "workspace", target)).resolves.toEqual(member())

        expect(members.require).toHaveBeenCalledWith("principal", "workspace")
        expect(em.query).toHaveBeenCalledWith(CHAT_TARGET_MEMBER, [
            "workspace",
            "member",
            target.room,
            target.conversationId,
        ])
    })

    it.each([
        { room: "unknown", conversationId: null },
        { room: "sales", conversationId: "conversation" },
    ])("refuses ambiguous or unknown targets before reading their state (%p)", async (target) => {
        const em = mockEntityManager()
        const { service } = await build(em)

        await expect(service.requireTarget("principal", "workspace", target)).rejects.toMatchObject({
            code: "CHAT_MARKERS_TARGET_NOT_FOUND",
        })

        expect(em.query).not.toHaveBeenCalled()
    })

    it.each([{ rows: [] }, { rows: [{ chat_target_member: false }] }])(
        "refuses absent, foreign or inaccessible targets (%p)",
        async ({ rows }) => {
            const em = mockEntityManager({ query: [CHAT_TARGET_MEMBER, rows] })
            const { service } = await build(em)

            await expect(service.state("principal", "workspace", CONVERSATION)).rejects.toMatchObject({
                code: "CHAT_MARKERS_TARGET_NOT_FOUND",
            })

            expect(em.query).toHaveBeenCalledTimes(1)
        },
    )

    it("never reads target state when membership is denied", async () => {
        const em = mockEntityManager()
        const { service, members } = await build(em)
        const refusal = new Error("Disabled or foreign member")
        members.require.mockRejectedValue(refusal)

        await expect(service.state("principal", "workspace", OFFICE)).rejects.toBe(refusal)

        expect(em.query).not.toHaveBeenCalled()
    })
})

/** The stored marker of a member, muted or not. */
const markerOf = (muted: boolean): ChatMarkerEntity => Object.assign(new ChatMarkerEntity(), { muted })

const OWN_ROW = { id: "message", createdAt: PERSISTED_AT }
const WITH_OWN: Cursors = { own: OWN_ROW }

describe("ChatMarkersService state", () => {
    it("returns the scoped bounded database projection without inferring ownership from names", async () => {
        const em = mockEntityManager({
            query: [
                [CHAT_TARGET_MEMBER, [{ chat_target_member: true }]],
                [CHAT_READER_AVATARS, [{ id: "reader", avatar_url: "https://cdn.example.test/reader.png" }]],
            ],
            findOne: [ChatMarkerEntity, markerOf(true)],
        })
        const [readers] = queueQueryBuilders(em, [{ getRawMany: [{ userId: "reader" }] }])
        const { service, rooms } = await build(em, [ME, READER], WITH_OWN)

        await expect(service.state("principal", "workspace", SALES)).resolves.toEqual({
            muted: true,
            lastOwnMessage: {
                id: "message",
                status: "seen",
                seenBy: [
                    {
                        id: "reader",
                        name: "Reader",
                        avatarSeed: "reader",
                        avatarUrl: "https://cdn.example.test/reader.png",
                    },
                ],
                seenByCount: 1,
            },
        })

        expect(em.query).toHaveBeenCalledWith(CHAT_READER_AVATARS, ["workspace", ["reader"]])
        expect(em.findOne).toHaveBeenCalledWith(ChatMarkerEntity, {
            where: { workspaceId: "workspace", userId: "member", targetKey: "sales" },
            select: { muted: true },
        })
        expect(rooms.newestAuthored).toHaveBeenCalledWith("workspace", "member", "sales", expect.anything())
        expect(readers?.callsOf("limit")).toEqual([[1]])
        expect(readers?.callsOf("andWhere")[0]?.[1]).toEqual({ room: "sales" })
        expect(readers?.callsOf("andWhere")[1]?.[1]).toMatchObject({ createdAt: PERSISTED_AT, ownId: "message" })
    })

    it("reads a conversation receipt from the agent messages and the conversation cursors", async () => {
        const em = mockEntityManager({
            query: [CHAT_TARGET_MEMBER, [{ chat_target_member: true }]],
            findOne: [ChatMarkerEntity, null],
        })
        const [readers, delivered] = queueQueryBuilders(em, [{ getRawMany: [] }, { getRawMany: [{ one: 1 }] }])
        const { service, conversations } = await build(em, [ME, READER], WITH_OWN)

        await expect(service.state("principal", "workspace", CONVERSATION)).resolves.toEqual({
            muted: false,
            lastOwnMessage: { id: "message", status: "delivered", seenBy: [], seenByCount: 0 },
        })

        expect(conversations.newestAuthored).toHaveBeenCalledWith(
            "workspace",
            "member",
            "conversation",
            expect.anything(),
        )
        expect(readers?.callsOf("andWhere")[0]?.[0]).toContain("s.conversation_id = :conversationId::uuid")
        expect(delivered?.callsOf("andWhere")[0]?.[1]).toEqual({ createdAt: PERSISTED_AT, ownId: "message" })
        expect(em.query).toHaveBeenCalledTimes(1)
    })
})

describe("ChatMarkersService state", () => {
    it("answers sent when no other member has read or received the message", async () => {
        const em = mockEntityManager({
            query: [CHAT_TARGET_MEMBER, [{ chat_target_member: true }]],
            findOne: [ChatMarkerEntity, markerOf(false)],
        })
        queueQueryBuilders(em, [{ getRawMany: [] }, { getRawMany: [] }])
        const { service } = await build(em, [ME, READER], WITH_OWN)

        await expect(service.state("principal", "workspace", OFFICE)).resolves.toEqual({
            muted: false,
            lastOwnMessage: { id: "message", status: "sent", seenBy: [], seenByCount: 0 },
        })
    })

    it("keeps an absent owned message null", async () => {
        const em = mockEntityManager({
            query: [CHAT_TARGET_MEMBER, [{ chat_target_member: true }]],
            findOne: [ChatMarkerEntity, markerOf(false)],
        })
        const { service } = await build(em)

        await expect(service.state("principal", "workspace", OFFICE)).resolves.toEqual({
            muted: false,
            lastOwnMessage: null,
        })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("shows a reader with no avatar row without an avatar address", async () => {
        const em = mockEntityManager({
            query: [
                [CHAT_TARGET_MEMBER, [{ chat_target_member: true }]],
                [CHAT_READER_AVATARS, []],
            ],
            findOne: [ChatMarkerEntity, null],
        })
        queueQueryBuilders(em, [{ getRawMany: [{ userId: "reader" }] }])
        const { service } = await build(em, [ME, READER], WITH_OWN)

        await expect(service.state("principal", "workspace", OFFICE)).resolves.toEqual({
            muted: false,
            lastOwnMessage: {
                id: "message",
                status: "seen",
                seenBy: [{ id: "reader", name: "Reader", avatarSeed: "reader", avatarUrl: null }],
                seenByCount: 1,
            },
        })
    })
})

const activityNameOf = (target: ChatTarget): string =>
    target.conversationId === null ? `room:${target.room ?? "office"}` : `conversation:${target.conversationId}`

/** A manager that admits the caller and accepts the write; the one query builder is the write. */
const receiptEm = () => {
    const em = mockEntityManager({ query: [CHAT_TARGET_MEMBER, [{ chat_target_member: true }]] })
    const [write] = queueQueryBuilders(em, [{ execute: {} }])
    return { em, write }
}

/** The instant the message lookups answer for the fetched message. */
const FETCHED: Cursors = { created: PERSISTED_AT }

const expectResolvedCursorWrite = (
    lookups: { readonly createdAtOf: unknown },
    write: FakeQueryBuilder | undefined,
    target: ChatTarget,
    cursors: object,
): void => {
    expect(lookups.createdAtOf).toHaveBeenCalledWith(
        "workspace",
        ...(target.conversationId === null ? [target.room] : [target.conversationId]),
        "fetched",
    )
    expect(evaluatedValues(write?.callsOf("values")[0]?.[0])).toEqual({
        workspaceId: "workspace",
        userId: "member",
        room: target.room ?? "",
        conversationId: target.conversationId,
        ...cursors,
    })
    expect(write?.callsOf("setParameter")).toEqual([["at", PERSISTED_AT]])
}

describe("ChatMarkersService delivered receipts", () => {
    it.each([{ target: SALES }, { target: CONVERSATION }])(
        "writes the resolved fetched cursor for delivered in $target without a transaction",
        async ({ target }) => {
            const { em, write } = receiptEm()
            const { service, roomReads, tx, activity, rooms, conversations } = await build(em, [], FETCHED)

            await service.markDelivered("principal", "workspace", target, "fetched")

            expectResolvedCursorWrite(target.conversationId === null ? rooms : conversations, write, target, {
                deliveredAt: ":at::timestamptz",
                deliveredMessageId: "fetched",
            })
            expect(activity.receipt.mock.calls).toEqual([["workspace", activityNameOf(target)]])
            expect(activity.unread).not.toHaveBeenCalled()
            expect(tx.outcomes).toEqual([])
            expect(roomReads.advance).not.toHaveBeenCalled()
        },
    )

    it("refuses a message outside the proven target without writing a cursor", async () => {
        const em = mockEntityManager({ query: [CHAT_TARGET_MEMBER, [{ chat_target_member: true }]] })
        const { service, activity } = await build(em)

        await expect(service.markDelivered("principal", "workspace", SALES, "foreign")).rejects.toMatchObject({
            code: "CHAT_MARKERS_MESSAGE_NOT_FOUND",
        })
        expect(activity.receipt).not.toHaveBeenCalled()

        expect(em.query).toHaveBeenCalledTimes(1)
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("ChatMarkersService read receipts", () => {
    it.each([{ target: OFFICE }, { target: SALES }, { target: CONVERSATION }])(
        "commits the resolved fetched cursor for read in $target",
        async ({ target }) => {
            const { em, write } = receiptEm()
            const { service, roomReads, tx, activity, rooms, conversations } = await build(em, [], FETCHED)

            await service.markRead("principal", "workspace", target, "fetched")

            expectResolvedCursorWrite(target.conversationId === null ? rooms : conversations, write, target, {
                deliveredAt: ":at::timestamptz",
                deliveredMessageId: "fetched",
                readAt: ":at::timestamptz",
                readMessageId: "fetched",
            })
            expect(activity.receipt.mock.calls).toEqual([["workspace", activityNameOf(target)]])
            expect(activity.unread.mock.calls).toEqual([["workspace", activityNameOf(target), "member"]])
            expect(tx.outcomes).toEqual(["commit"])
            if (target.conversationId === null) {
                expect(roomReads.advance).toHaveBeenCalledWith(
                    "workspace",
                    "member",
                    target.room ?? "",
                    PERSISTED_AT,
                    expect.any(Object),
                )
                expect(roomReads.advance.mock.calls[0]?.[4]).not.toBe(em)
            } else expect(roomReads.advance).not.toHaveBeenCalled()
        },
    )

    it("rolls back the precise receipt when the room owner cannot advance its compatible read marker", async () => {
        const { em, write } = receiptEm()
        const { service, roomReads, tx, activity } = await build(em, [], FETCHED)
        const failure = new Error("Room cursor write failed")
        roomReads.advance.mockRejectedValue(failure)

        await expect(service.markRead("principal", "workspace", SALES, "fetched")).rejects.toBe(failure)

        expect(tx.outcomes).toEqual(["rollback"])
        expect(tx.committedWrites).toEqual([])
        expect(write?.callsOf("execute")).toHaveLength(1)
        expect(activity.receipt).not.toHaveBeenCalled()
        expect(activity.unread).not.toHaveBeenCalled()
    })
})

describe("ChatMarkersService mute", () => {
    it.each([
        { target: OFFICE, muted: true },
        { target: SALES, muted: false },
        { target: CONVERSATION, muted: true },
    ])("writes only the proven account preference for $target", async ({ target, muted }) => {
        const em = mockEntityManager({ query: [CHAT_TARGET_MEMBER, [{ chat_target_member: true }]] })
        const [write] = queueQueryBuilders(em, [{ execute: {} }])
        const { service, activity } = await build(em)

        await service.mute("principal", "workspace", target, muted)

        expect(activity.unread.mock.calls).toEqual([["workspace", activityNameOf(target), "member"]])

        expect(em.createQueryBuilder).toHaveBeenCalledWith(ChatMarkerEntity, "chat_markers")
        expect(write?.callsOf("values")).toEqual([
            [
                {
                    workspaceId: "workspace",
                    userId: "member",
                    room: target.room ?? "",
                    conversationId: target.conversationId,
                    muted,
                },
            ],
        ])
        expect(write?.callsOf("orUpdate")).toEqual([[["muted"], ["workspace_id", "user_id", "target_key"]]])
    })
})

describe("ChatMarkersService memberIds", () => {
    it("lists the admitted accounts only after the caller itself is admitted", async () => {
        const em = mockEntityManager({ query: [CHAT_TARGET_MEMBER, [{ chat_target_member: true }]] })
        const { service, seats } = await build(em, [
            { userId: "a", displayName: "A" },
            { userId: "b", displayName: "B" },
        ])

        await expect(service.memberIds("principal", "workspace", SALES)).resolves.toEqual(["a", "b"])

        expect(em.query).toHaveBeenCalledTimes(1)
        expect(seats.activeUsers).toHaveBeenCalledWith("workspace", 500)
    })

    it("answers sent without reading any cursor when nobody else is active", async () => {
        const em = mockEntityManager({
            query: [CHAT_TARGET_MEMBER, [{ chat_target_member: true }]],
            findOne: [ChatMarkerEntity, null],
        })
        const { service } = await build(em, [ME], WITH_OWN)

        await expect(service.state("principal", "workspace", OFFICE)).resolves.toEqual({
            muted: false,
            lastOwnMessage: { id: "message", status: "sent", seenBy: [], seenByCount: 0 },
        })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("names at most three readers and counts all of them", async () => {
        const em = mockEntityManager({
            query: [
                [CHAT_TARGET_MEMBER, [{ chat_target_member: true }]],
                [CHAT_READER_AVATARS, []],
            ],
            findOne: [ChatMarkerEntity, null],
        })
        queueQueryBuilders(em, [{ getRawMany: ["r1", "r2", "r3", "r4"].map((userId) => ({ userId })) }])
        const roster = [ME, ...["r1", "r2", "r3", "r4", "r5"].map((userId) => ({ userId, displayName: userId }))]
        const { service } = await build(em, roster, WITH_OWN)

        const state = await service.state("principal", "workspace", OFFICE)

        expect(state.lastOwnMessage?.seenBy.map((reader) => reader.id)).toEqual(["r1", "r2", "r3"])
        expect(state.lastOwnMessage?.seenByCount).toBe(4)
    })

    it("refuses a caller the target does not admit, without listing anyone", async () => {
        const em = mockEntityManager({ query: [CHAT_TARGET_MEMBER, [{ chat_target_member: false }]] })
        const { service } = await build(em)

        await expect(service.memberIds("principal", "workspace", OFFICE)).rejects.toMatchObject({
            code: "CHAT_MARKERS_TARGET_NOT_FOUND",
        })
        expect(em.query).toHaveBeenCalledTimes(1)
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})
