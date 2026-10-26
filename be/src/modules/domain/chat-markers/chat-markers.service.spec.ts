import { Test } from "@nestjs/testing"
import { builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { OfficeReadMarkersService } from "@modules/domain/office-rooms"
import type { ChatTarget } from "./chat-markers.contracts"
import { ChatMarkersService } from "./chat-markers.service"
import {
    CHAT_MARKER_STATE,
    CHAT_MESSAGE_CURSOR,
    CHAT_TARGET_MEMBER,
    MARK_CHAT_DELIVERED,
    MARK_CHAT_READ,
    SET_CHAT_MUTED,
} from "./persistence/chat-markers.sql"

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

const build = async (em: MockEntityManager) => {
    const tx = fakeTransaction(em)
    const members = mock<WorkspaceMembersService>({ require: jest.fn().mockResolvedValue(member()) })
    const roomReads = mock<OfficeReadMarkersService>({ advance: jest.fn().mockResolvedValue(undefined) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChatMarkersService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: OfficeReadMarkersService, useValue: roomReads },
        ],
    }).compile()
    return { service: moduleRef.get(ChatMarkersService), members, roomReads, tx }
}

describe("ChatMarkersService admission", () => {
    it.each([OFFICE, SALES, CONVERSATION])("proves active membership and target scope for %p", async (target) => {
        const em = mockEntityManager({ query: [CHAT_TARGET_MEMBER, [{ allowed: true }]] })
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

    it.each([{ rows: [] }, { rows: [{ allowed: false }] }])(
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

describe("ChatMarkersService state", () => {
    it("returns the scoped bounded database projection without inferring ownership from names", async () => {
        const lastOwnMessage = {
            id: "message",
            status: "seen",
            seenBy: [{ id: "reader", name: "Reader", avatarSeed: "reader" }],
            seenByCount: 4,
        }
        const em = mockEntityManager({
            query: [
                [CHAT_TARGET_MEMBER, [{ allowed: true }]],
                [CHAT_MARKER_STATE, [{ muted: true, last_own_message: lastOwnMessage }]],
            ],
        })
        const { service } = await build(em)

        await expect(service.state("principal", "workspace", SALES)).resolves.toEqual({
            muted: true,
            lastOwnMessage,
        })

        expect(em.query).toHaveBeenCalledWith(CHAT_MARKER_STATE, ["workspace", "member", "sales", null])
    })

    it("keeps an absent owned message null", async () => {
        const em = mockEntityManager({
            query: [
                [CHAT_TARGET_MEMBER, [{ allowed: true }]],
                [CHAT_MARKER_STATE, [{ muted: false, last_own_message: null }]],
            ],
        })
        const { service } = await build(em)

        await expect(service.state("principal", "workspace", OFFICE)).resolves.toEqual({
            muted: false,
            lastOwnMessage: null,
        })
    })
})

const receiptQuery = (statement: string): Array<[string, Array<object>]> => [
    [CHAT_TARGET_MEMBER, [{ allowed: true }]],
    [CHAT_MESSAGE_CURSOR, [{ created_at: PERSISTED_AT }]],
    [statement, []],
]

const expectResolvedCursorWrite = (em: MockEntityManager, target: ChatTarget, statement: string): void => {
    expect(em.query).toHaveBeenCalledWith(CHAT_MESSAGE_CURSOR, [
        "workspace",
        target.room,
        target.conversationId,
        "fetched",
    ])
    expect(em.query).toHaveBeenCalledWith(statement, [
        "workspace",
        "member",
        target.room ?? "",
        target.conversationId,
        PERSISTED_AT,
        "fetched",
    ])
}

describe("ChatMarkersService delivered receipts", () => {
    it.each([{ target: SALES }, { target: CONVERSATION }])(
        "writes the resolved fetched cursor for delivered in $target without a transaction",
        async ({ target }) => {
            const em = mockEntityManager({ query: receiptQuery(MARK_CHAT_DELIVERED) })
            const { service, roomReads, tx } = await build(em)

            await service.markDelivered("principal", "workspace", target, "fetched")

            expectResolvedCursorWrite(em, target, MARK_CHAT_DELIVERED)
            expect(tx.outcomes).toEqual([])
            expect(roomReads.advance).not.toHaveBeenCalled()
        },
    )

    it("refuses a message outside the proven target without writing a cursor", async () => {
        const em = mockEntityManager({
            query: [
                [CHAT_TARGET_MEMBER, [{ allowed: true }]],
                [CHAT_MESSAGE_CURSOR, []],
            ],
        })
        const { service } = await build(em)

        await expect(service.markDelivered("principal", "workspace", SALES, "foreign")).rejects.toMatchObject({
            code: "CHAT_MARKERS_MESSAGE_NOT_FOUND",
        })

        expect(em.query).toHaveBeenCalledTimes(2)
    })
})

describe("ChatMarkersService read receipts", () => {
    it.each([{ target: OFFICE }, { target: SALES }, { target: CONVERSATION }])(
        "commits the resolved fetched cursor for read in $target",
        async ({ target }) => {
            const em = mockEntityManager({ query: receiptQuery(MARK_CHAT_READ) })
            const { service, roomReads, tx } = await build(em)

            await service.markRead("principal", "workspace", target, "fetched")

            expectResolvedCursorWrite(em, target, MARK_CHAT_READ)
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
        const em = mockEntityManager({ query: receiptQuery(MARK_CHAT_READ) })
        const { service, roomReads, tx } = await build(em)
        const failure = new Error("Room cursor write failed")
        roomReads.advance.mockRejectedValue(failure)

        await expect(service.markRead("principal", "workspace", SALES, "fetched")).rejects.toBe(failure)

        expect(tx.outcomes).toEqual(["rollback"])
        expect(tx.committedWrites).toEqual([])
        expect(tx.rolledBackWrites).toHaveLength(1)
    })
})

describe("ChatMarkersService mute", () => {
    it.each([
        { target: OFFICE, muted: true },
        { target: SALES, muted: false },
        { target: CONVERSATION, muted: true },
    ])("writes only the proven account preference for $target", async ({ target, muted }) => {
        const em = mockEntityManager({
            query: [
                [CHAT_TARGET_MEMBER, [{ allowed: true }]],
                [SET_CHAT_MUTED, []],
            ],
        })
        const { service } = await build(em)

        await service.mute("principal", "workspace", target, muted)

        expect(em.query).toHaveBeenCalledWith(SET_CHAT_MUTED, [
            "workspace",
            "member",
            target.room ?? "",
            target.conversationId,
            muted,
        ])
    })
})
