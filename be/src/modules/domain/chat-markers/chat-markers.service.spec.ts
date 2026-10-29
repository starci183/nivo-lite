import { Test } from "@nestjs/testing"
import { builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { ChatActivityService } from "@modules/domain/chat-activity"
import { WorkspaceMembersService, WorkspaceMemberEntity } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { OfficeReadMarkersService } from "@modules/domain/office-rooms"
import type { ChatTarget } from "./chat-markers.contracts"
import { ChatMarkersService } from "./chat-markers.service"
import { ChatMarkerEntity } from "./persistence/entities"
import type { FakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { MessageEntity } from "@modules/domain/messages"
import { AgentMessageEntity } from "@modules/domain/agent-messages"

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

const build = async (em: MockEntityManager) => {
    const tx = fakeTransaction(em)
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
        ],
    }).compile()
    return { service: moduleRef.get(ChatMarkersService), members, roomReads, tx, activity }
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

describe("ChatMarkersService state", () => {
    it("returns the scoped bounded database projection without inferring ownership from names", async () => {
        const em = mockEntityManager({
            query: [
                [CHAT_TARGET_MEMBER, [{ chat_target_member: true }]],
                [CHAT_READER_AVATARS, [{ id: "reader", avatar_url: "https://cdn.example.test/reader.png" }]],
            ],
            findOne: [ChatMarkerEntity, markerOf(true)],
        })
        const [own, readers] = queueQueryBuilders(em, [
            { getRawMany: [OWN_ROW] },
            { getRawMany: [{ id: "reader", name: "Reader", total: 4 }] },
        ])
        const { service } = await build(em)

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
                seenByCount: 4,
            },
        })

        expect(em.query).toHaveBeenCalledWith(CHAT_READER_AVATARS, ["workspace", ["reader"]])
        expect(em.findOne).toHaveBeenCalledWith(ChatMarkerEntity, {
            where: { workspaceId: "workspace", userId: "member", targetKey: "sales" },
            select: { muted: true },
        })
        expect(em.createQueryBuilder).toHaveBeenCalledWith(MessageEntity, "m")
        expect(own?.callsOf("andWhere")).toEqual([["m.room = :room", { room: "sales" }]])
        expect(readers?.callsOf("limit")).toEqual([[3]])
        expect(readers?.callsOf("andWhere")[0]?.[1]).toEqual({
            room: "sales",
            conversationId: null,
            createdAt: PERSISTED_AT,
            ownId: "message",
        })
    })

    it("reads a conversation receipt from the agent messages and the conversation cursors", async () => {
        const em = mockEntityManager({
            query: [CHAT_TARGET_MEMBER, [{ chat_target_member: true }]],
            findOne: [ChatMarkerEntity, null],
        })
        const [, readers, delivered] = queueQueryBuilders(em, [
            { getRawMany: [OWN_ROW] },
            { getRawMany: [] },
            { getRawMany: [{ one: 1 }] },
        ])
        const { service } = await build(em)

        await expect(service.state("principal", "workspace", CONVERSATION)).resolves.toEqual({
            muted: false,
            lastOwnMessage: { id: "message", status: "delivered", seenBy: [], seenByCount: 0 },
        })

        expect(em.createQueryBuilder).toHaveBeenCalledWith(AgentMessageEntity, "m")
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
        queueQueryBuilders(em, [{ getRawMany: [OWN_ROW] }, { getRawMany: [] }, { getRawMany: [] }])
        const { service } = await build(em)

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
        const [own] = queueQueryBuilders(em, [{ getRawMany: [] }])
        const { service } = await build(em)

        await expect(service.state("principal", "workspace", OFFICE)).resolves.toEqual({
            muted: false,
            lastOwnMessage: null,
        })
        expect(own?.callsOf("andWhere")).toEqual([["true", { room: null }]])
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(1)
    })

    it("shows a reader with no avatar row without an avatar address", async () => {
        const em = mockEntityManager({
            query: [
                [CHAT_TARGET_MEMBER, [{ chat_target_member: true }]],
                [CHAT_READER_AVATARS, []],
            ],
            findOne: [ChatMarkerEntity, null],
        })
        queueQueryBuilders(em, [
            { getRawMany: [OWN_ROW] },
            { getRawMany: [{ id: "reader", name: "Reader", total: 1 }] },
        ])
        const { service } = await build(em)

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

    it.each([{ id: "message" }, { id: 7, createdAt: PERSISTED_AT }])(
        "keeps an owned message row %j without a text id and instant null",
        async (row) => {
            const em = mockEntityManager({
                query: [CHAT_TARGET_MEMBER, [{ chat_target_member: true }]],
                findOne: [ChatMarkerEntity, null],
            })
            queueQueryBuilders(em, [{ getRawMany: [row] }])
            const { service } = await build(em)

            await expect(service.state("principal", "workspace", OFFICE)).resolves.toEqual({
                muted: false,
                lastOwnMessage: null,
            })
        },
    )
})

describe("ChatMarkersService state", () => {
    it("keeps an owned message without a readable instant null", async () => {
        const em = mockEntityManager({
            query: [CHAT_TARGET_MEMBER, [{ chat_target_member: true }]],
            findOne: [ChatMarkerEntity, null],
        })
        queueQueryBuilders(em, [{ getRawMany: ["broken"] }])
        const { service } = await build(em)

        await expect(service.state("principal", "workspace", OFFICE)).resolves.toEqual({
            muted: false,
            lastOwnMessage: null,
        })
    })
})

const activityNameOf = (target: ChatTarget): string =>
    target.conversationId === null ? `room:${target.room ?? "office"}` : `conversation:${target.conversationId}`

/** A manager that admits the caller, finds the message and accepts the write; the builders are the cursor read, then the write. */
const receiptEm = () => {
    const em = mockEntityManager({ query: [CHAT_TARGET_MEMBER, [{ chat_target_member: true }]] })
    const [cursor, write] = queueQueryBuilders(em, [{ getRawMany: [{ createdAt: PERSISTED_AT }] }, { execute: {} }])
    return { em, cursor, write }
}

const expectResolvedCursorWrite = (
    em: MockEntityManager,
    cursor: FakeQueryBuilder | undefined,
    write: FakeQueryBuilder | undefined,
    target: ChatTarget,
    cursors: object,
): void => {
    expect(em.createQueryBuilder).toHaveBeenNthCalledWith(
        1,
        target.conversationId === null ? MessageEntity : AgentMessageEntity,
        "m",
    )
    expect(cursor?.callsOf("where")[0]?.[1]).toMatchObject({ workspaceId: "workspace", messageId: "fetched" })
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
            const { em, cursor, write } = receiptEm()
            const { service, roomReads, tx, activity } = await build(em)

            await service.markDelivered("principal", "workspace", target, "fetched")

            expectResolvedCursorWrite(em, cursor, write, target, {
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
        queueQueryBuilders(em, [{ getRawMany: [] }])
        const { service, activity } = await build(em)

        await expect(service.markDelivered("principal", "workspace", SALES, "foreign")).rejects.toMatchObject({
            code: "CHAT_MARKERS_MESSAGE_NOT_FOUND",
        })
        expect(activity.receipt).not.toHaveBeenCalled()

        expect(em.query).toHaveBeenCalledTimes(1)
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(1)
    })

    it("refuses a message whose lookup answers rows that carry no instant", async () => {
        const em = mockEntityManager({ query: [CHAT_TARGET_MEMBER, [{ chat_target_member: true }]] })
        queueQueryBuilders(em, [{ getRawMany: ["broken", { createdAt: 7 }] }])
        const { service } = await build(em)

        await expect(service.markDelivered("principal", "workspace", SALES, "foreign")).rejects.toMatchObject({
            code: "CHAT_MARKERS_MESSAGE_NOT_FOUND",
        })
    })
})

describe("ChatMarkersService read receipts", () => {
    it.each([{ target: OFFICE }, { target: SALES }, { target: CONVERSATION }])(
        "commits the resolved fetched cursor for read in $target",
        async ({ target }) => {
            const { em, cursor, write } = receiptEm()
            const { service, roomReads, tx, activity } = await build(em)

            await service.markRead("principal", "workspace", target, "fetched")

            expectResolvedCursorWrite(em, cursor, write, target, {
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
        const { service, roomReads, tx, activity } = await build(em)
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
        const [listing] = queueQueryBuilders(em, [{ getRawMany: [{ user_id: "a" }, { user_id: "b" }] }])
        const { service } = await build(em)

        await expect(service.memberIds("principal", "workspace", SALES)).resolves.toEqual(["a", "b"])

        expect(em.query).toHaveBeenCalledTimes(1)
        expect(em.createQueryBuilder).toHaveBeenCalledWith(WorkspaceMemberEntity, "m")
        expect(listing?.callsOf("where")).toEqual([
            ["m.workspace_id = :workspaceId AND m.status = 'active'", { workspaceId: "workspace" }],
        ])
        expect(listing?.callsOf("orderBy")).toEqual([["m.user_id"]])
        expect(listing?.callsOf("limit")).toEqual([[500]])
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
