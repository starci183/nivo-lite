import { Test } from "@nestjs/testing"
import { fakeIds, fakeTransaction, mockEntityManager, queueQueryBuilders } from "@starci/jest-preset"
import type { FakeQueryBuilder, MockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { IDS } from "@modules/platform/ids"
import { isRecord } from "@modules/platform/primitives"
import { ChatRoomEntity, ChatRoomMemberEntity, ChatRoomMessageEntity, ChatRoomPinEntity } from "./persistence/entities"
import { TeamChatStoreService } from "./team-chat-store.service"

const WS = "11111111-1111-4111-8111-111111111111"
const ANA = "22222222-1111-4111-8111-111111111111"
const BEN = "23333333-1111-4111-8111-111111111111"
const BOT = "31111111-1111-4111-8111-111111111111"
const ROOM = "41111111-1111-4111-8111-111111111111"
const MSG = "51111111-1111-4111-8111-111111111111"
const NEW_ID = "00000000-0000-4000-8000-000000000001"
const KEY = `user:${ANA}|user:${BEN}`
const anyFunction: unknown = expect.any(Function)

const room = Object.assign(new ChatRoomEntity(), { id: ROOM, workspaceId: WS })
const message = Object.assign(new ChatRoomMessageEntity(), { id: MSG, roomId: ROOM })
const clash = { code: "23505" }

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            TeamChatStoreService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: IDS, useValue: fakeIds() },
        ],
    }).compile()
    return moduleRef.get(TeamChatStoreService)
}

/** The conditions a query builder was given with `andWhere`, in order. */
const conditionsOf = (fake: FakeQueryBuilder | undefined): Array<unknown> =>
    (fake?.callsOf("andWhere") ?? []).map(([condition]) => condition)

/** The text the set expression of an update builder yields. */
const readExpressionOf = (fake: FakeQueryBuilder | undefined): unknown => {
    const [values] = fake?.callsOf("set")[0] ?? []
    const expression: unknown = isRecord(values) ? values["lastReadAt"] : undefined
    return typeof expression === "function" ? Reflect.apply(expression, undefined, []) : undefined
}

describe("TeamChatStoreService room reads", () => {
    it("reads one room of the workspace, by id, by ids and by direct key", async () => {
        const em = mockEntityManager({
            findOne: [ChatRoomEntity, room],
            findOneOrFail: [ChatRoomEntity, room],
            find: [ChatRoomEntity, [room]],
        })
        const store = await build(em)
        await expect(store.roomById(WS, ROOM)).resolves.toBe(room)
        await expect(store.roomOrFail(WS, ROOM)).resolves.toBe(room)
        await expect(store.roomByDirectKey(WS, KEY)).resolves.toBe(room)
        await expect(store.roomsByIds(WS, [ROOM])).resolves.toEqual([room])
        expect(em.findOne).toHaveBeenNthCalledWith(1, ChatRoomEntity, { where: { id: ROOM, workspaceId: WS } })
        expect(em.findOneOrFail).toHaveBeenCalledWith(ChatRoomEntity, { where: { id: ROOM, workspaceId: WS } })
        expect(em.findOne).toHaveBeenNthCalledWith(2, ChatRoomEntity, { where: { workspaceId: WS, directKey: KEY } })
        expect(em.find).toHaveBeenCalledWith(ChatRoomEntity, { where: { id: In([ROOM]), workspaceId: WS }, take: 1 })
    })

    it("lists the rooms a person sits in, narrowed by kind and by another member, bounded", async () => {
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [{ getMany: [room] }])
        const store = await build(em)
        await expect(store.rooms(WS, { viewerId: ANA, owner: false, kind: "group", member: BEN })).resolves.toEqual([
            room,
        ])
        expect(conditionsOf(fake)).toEqual([
            "room.kind = :kind",
            expect.stringContaining("w.member_id = :member AND w.member_id <> :viewerId"),
            expect.stringContaining("m.member_kind = 'user' AND m.member_id = :viewerId"),
        ])
        expect(fake?.callsOf("take")).toEqual([[500]])
    })

    it("lists every room of the workspace for an owner with no narrowing", async () => {
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [{ getMany: [] }])
        const store = await build(em)
        await expect(store.rooms(WS, { viewerId: ANA, owner: true, kind: null, member: null })).resolves.toEqual([])
        expect(fake?.callsOf("andWhere")).toEqual([
            ["TRUE", { kind: null }],
            ["TRUE", { member: null, viewerId: ANA }],
            ["TRUE", { viewerId: ANA }],
        ])
    })
})

describe("TeamChatStoreService opening and deleting rooms", () => {
    const opening = { workspaceId: WS, createdBy: ANA, kind: "direct", name: null, directKey: KEY, others: [] } as const

    it("opens a room and its seats in one transaction, the creator as owner, with an id of the ids port", async () => {
        const em = mockEntityManager({
            insert: [
                [ChatRoomEntity, {}],
                [ChatRoomMemberEntity, {}],
            ],
            findOneOrFail: [ChatRoomEntity, room],
        })
        const tx = fakeTransaction(em)
        const store = await build(em)
        await expect(store.insertRoom({ ...opening, others: [{ memberKind: "agent", memberId: BOT }] })).resolves.toBe(
            room,
        )
        expect(tx.committedWrites).toMatchObject([
            {
                method: "insert",
                args: [
                    ChatRoomEntity,
                    { id: NEW_ID, workspaceId: WS, kind: "direct", name: null, directKey: KEY, createdBy: ANA },
                ],
            },
            {
                method: "insert",
                args: [
                    ChatRoomMemberEntity,
                    [
                        expect.objectContaining({ roomId: NEW_ID, memberKind: "user", memberId: ANA, role: "owner" }),
                        expect.objectContaining({ roomId: NEW_ID, memberKind: "agent", memberId: BOT, role: "member" }),
                    ],
                ],
            },
        ])
    })

    it("answers the room that won when two people open the same direct room at once", async () => {
        const em = mockEntityManager({ insert: [ChatRoomEntity, {}], findOneOrFail: [ChatRoomEntity, room] })
        em.insert.mockRejectedValueOnce(clash)
        const tx = fakeTransaction(em)
        const store = await build(em)
        await expect(store.insertRoom(opening)).resolves.toBe(room)
        expect(tx.rollbacks).toBe(1)
        expect(em.findOneOrFail).toHaveBeenLastCalledWith(ChatRoomEntity, {
            where: { workspaceId: WS, directKey: KEY },
        })
    })

    it("lets any other failure through, and a clash of a group that has no pair key", async () => {
        const em = mockEntityManager({ insert: [ChatRoomEntity, {}] })
        fakeTransaction(em)
        const store = await build(em)
        em.insert.mockRejectedValueOnce({ code: "40001" })
        await expect(store.insertRoom(opening)).rejects.toEqual({ code: "40001" })
        em.insert.mockRejectedValueOnce(clash)
        await expect(store.insertRoom({ ...opening, kind: "group", name: "Team", directKey: null })).rejects.toBe(clash)
    })

    it("deletes a room by id", async () => {
        const em = mockEntityManager({ delete: [ChatRoomEntity, { affected: 1 }] })
        await (await build(em)).deleteRoom(ROOM)
        expect(em.delete).toHaveBeenCalledWith(ChatRoomEntity, { id: ROOM })
    })
})

describe("TeamChatStoreService seats", () => {
    it("reads one seat, and the seats of rooms up to the member bound of each", async () => {
        const seat = Object.assign(new ChatRoomMemberEntity(), { roomId: ROOM })
        const em = mockEntityManager({ findOne: [ChatRoomMemberEntity, seat], find: [ChatRoomMemberEntity, [seat]] })
        const store = await build(em)
        await expect(store.memberOf(ROOM, { memberKind: "user", memberId: ANA })).resolves.toBe(seat)
        await expect(store.membersOf([ROOM, "r2"])).resolves.toEqual([seat])
        expect(em.findOne).toHaveBeenCalledWith(ChatRoomMemberEntity, {
            where: { roomId: ROOM, memberKind: "user", memberId: ANA },
        })
        expect(em.find).toHaveBeenCalledWith(ChatRoomMemberEntity, { where: { roomId: In([ROOM, "r2"]) }, take: 400 })
    })

    it("seats a member read up to now and takes one out", async () => {
        const em = mockEntityManager({
            insert: [ChatRoomMemberEntity, {}],
            delete: [ChatRoomMemberEntity, { affected: 1 }],
        })
        const store = await build(em)
        await store.insertMember(WS, ROOM, { memberKind: "agent", memberId: BOT })
        await store.deleteMember(ROOM, { memberKind: "agent", memberId: BOT })
        expect(em.insert).toHaveBeenCalledWith(ChatRoomMemberEntity, {
            roomId: ROOM,
            workspaceId: WS,
            memberKind: "agent",
            memberId: BOT,
            role: "member",
            lastReadAt: anyFunction,
        })
        const [, inserted] = em.insert.mock.calls[0] ?? []
        const stamp: unknown = isRecord(inserted) ? inserted["lastReadAt"] : undefined
        expect(typeof stamp === "function" ? Reflect.apply(stamp, undefined, []) : undefined).toBe("now()")
        expect(em.delete).toHaveBeenCalledWith(ChatRoomMemberEntity, {
            roomId: ROOM,
            memberKind: "agent",
            memberId: BOT,
        })
    })

    it("sets the mute of a person's seat and says whether the person had one", async () => {
        const em = mockEntityManager({ update: [ChatRoomMemberEntity, { affected: 1 }] })
        const store = await build(em)
        await expect(store.setMuted(ROOM, ANA, true)).resolves.toBe(true)
        expect(em.update).toHaveBeenCalledWith(
            ChatRoomMemberEntity,
            { roomId: ROOM, memberKind: "user", memberId: ANA },
            { muted: true },
        )
        em.update.mockResolvedValueOnce({ affected: 0, raw: [], generatedMaps: [] })
        await expect(store.setMuted(ROOM, ANA, false)).resolves.toBe(false)
    })

    it("moves a read position to the moment of one message, or to now, never back", async () => {
        const em = mockEntityManager()
        const [toMessage, toNow] = queueQueryBuilders(em, [{ execute: {} }, { execute: {} }])
        const store = await build(em)
        await store.moveReadPosition(WS, ROOM, ANA, MSG)
        await store.moveReadPosition(WS, ROOM, ANA, null)
        expect(readExpressionOf(toMessage)).toContain("WHERE id = :messageId")
        expect(readExpressionOf(toNow)).toBe("GREATEST(last_read_at, now())")
        expect(toMessage?.callsOf("update")).toEqual([[ChatRoomMemberEntity]])
        expect(toMessage?.callsOf("setParameter")).toEqual([["messageId", MSG]])
        expect(toNow?.callsOf("where")[0]).toEqual([
            expect.stringContaining("room_id = :roomId AND member_kind = 'user'"),
            { roomId: ROOM, userId: ANA, workspaceId: WS },
        ])
    })
})

describe("TeamChatStoreService messages", () => {
    it("reads one message of a room and the messages of the workspace by id, none for no id", async () => {
        const em = mockEntityManager({
            findOne: [ChatRoomMessageEntity, message],
            find: [ChatRoomMessageEntity, [message]],
        })
        const store = await build(em)
        await expect(store.messageIn(WS, ROOM, MSG)).resolves.toBe(message)
        await expect(store.messagesByIds(WS, [MSG])).resolves.toEqual([message])
        await expect(store.messagesByIds(WS, [])).resolves.toEqual([])
        expect(em.find).toHaveBeenCalledTimes(1)
        expect(em.find).toHaveBeenCalledWith(ChatRoomMessageEntity, {
            where: { id: In([MSG]), workspaceId: WS },
            take: 1,
        })
    })

    it("finds the message an author sent under a client id, and none when no client id was sent", async () => {
        const em = mockEntityManager({ findOne: [ChatRoomMessageEntity, message] })
        const store = await build(em)
        await expect(store.sentBefore(WS, ROOM, ANA, "c1")).resolves.toBe(message)
        await expect(store.sentBefore(WS, ROOM, ANA, null)).resolves.toBeNull()
        expect(em.findOne).toHaveBeenCalledTimes(1)
        expect(em.findOne).toHaveBeenCalledWith(ChatRoomMessageEntity, {
            where: { workspaceId: WS, roomId: ROOM, authorId: ANA, clientId: "c1" },
        })
    })
})

describe("TeamChatStoreService storing a text", () => {
    const text = {
        workspaceId: WS,
        roomId: ROOM,
        authorId: ANA,
        body: "hi",
        clientId: "c1",
        mentions: [],
        attachments: [],
    }

    it("stores a person's text under an id of the ids port and reads it back", async () => {
        const em = mockEntityManager({
            insert: [ChatRoomMessageEntity, {}],
            findOneOrFail: [ChatRoomMessageEntity, message],
        })
        const store = await build(em)
        await expect(store.insertText(text)).resolves.toBe(message)
        expect(em.insert).toHaveBeenCalledWith(ChatRoomMessageEntity, {
            id: NEW_ID,
            roomId: ROOM,
            workspaceId: WS,
            authorKind: "user",
            authorId: ANA,
            body: "hi",
            kind: "text",
            ref: null,
            mentions: [],
            attachments: [],
            clientId: "c1",
            replyTo: null,
        })
    })

    it("answers the first write when a retry lost the race, and lets any other failure through", async () => {
        const em = mockEntityManager({ insert: [ChatRoomMessageEntity, {}], findOne: [ChatRoomMessageEntity, message] })
        const store = await build(em)
        em.insert.mockRejectedValueOnce(clash)
        await expect(store.insertText(text)).resolves.toBe(message)
        em.insert.mockRejectedValueOnce({ code: "40001" })
        await expect(store.insertText(text)).rejects.toEqual({ code: "40001" })
        em.insert.mockRejectedValueOnce(clash)
        await expect(store.insertText({ ...text, clientId: null })).rejects.toBe(clash)
    })
})

describe("TeamChatStoreService thread reads", () => {
    it("reads the keys of the first page of a thread, one more than the size", async () => {
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [{ getRawMany: [{ id: MSG, at: "2026-11-06T10:00:00.000001Z" }] }])
        const store = await build(em)
        await expect(store.threadKeys(WS, ROOM, null, 30, false)).resolves.toEqual([
            { id: MSG, at: "2026-11-06T10:00:00.000001Z" },
        ])
        expect(fake?.callsOf("andWhere")).toEqual([])
        expect(fake?.callsOf("limit")).toEqual([[31]])
        expect(fake?.callsOf("orderBy")).toEqual([["msg.created_at", "DESC"]])
    })

    it("continues after a position and keeps only the pinned messages when asked", async () => {
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [{ getRawMany: [] }])
        const store = await build(em)
        await store.threadKeys(WS, ROOM, { at: "2026-11-06T10:00:00.000001Z", id: MSG }, 5, true)
        expect(fake?.callsOf("andWhere")).toEqual([
            [
                "(msg.created_at, msg.id) < (CAST(:afterAt AS timestamptz), CAST(:afterId AS uuid))",
                { afterAt: "2026-11-06T10:00:00.000001Z", afterId: MSG },
            ],
            [expect.stringContaining("chat_room_pins p WHERE p.message_id = msg.id")],
        ])
        expect(fake?.callsOf("limit")).toEqual([[6]])
    })

    it("reads the newest message id of each room", async () => {
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [{ getRawMany: [{ id: MSG }] }])
        const store = await build(em)
        await expect(store.lastMessageIds(WS, [ROOM, "r2"])).resolves.toEqual([MSG])
        expect(fake?.callsOf("select")).toEqual([["DISTINCT ON (msg.room_id) msg.id", "id"]])
        expect(fake?.callsOf("limit")).toEqual([[2]])
    })
})

describe("TeamChatStoreService unread counts", () => {
    it("counts what each room of the viewer has unread, as numbers", async () => {
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [{ getRawMany: [{ room_id: ROOM, unread: "3", mentions: "1" }] }])
        const store = await build(em)
        await expect(store.unreadRows(WS, ANA, null)).resolves.toEqual([
            { roomId: ROOM, unreadCount: 3, mentionCount: 1 },
        ])
        expect(fake?.callsOf("andWhere")).toEqual([])
        expect(fake?.callsOf("where")[0]?.[1]).toEqual({
            workspaceId: WS,
            viewerId: ANA,
            mention: JSON.stringify([{ kind: "user", id: ANA }]),
        })
    })

    it("counts one room when one is named", async () => {
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [{ getRawMany: [] }])
        const store = await build(em)
        await expect(store.unreadRows(WS, ANA, ROOM)).resolves.toEqual([])
        expect(fake?.callsOf("andWhere")).toEqual([["m.room_id = :roomId", { roomId: ROOM }]])
    })
})

describe("TeamChatStoreService pins", () => {
    it("reads which messages are pinned, pins one and takes a pin off", async () => {
        const em = mockEntityManager({
            find: [ChatRoomPinEntity, [Object.assign(new ChatRoomPinEntity(), { messageId: MSG })]],
            delete: [ChatRoomPinEntity, { affected: 1 }],
        })
        const [fake] = queueQueryBuilders(em, [{ execute: {} }])
        const store = await build(em)
        await expect(store.pinnedAmong([MSG])).resolves.toEqual(new Set([MSG]))
        await store.insertPin(WS, ROOM, MSG, ANA)
        await store.deletePin(ROOM, MSG)
        expect(em.find).toHaveBeenCalledWith(ChatRoomPinEntity, { where: { messageId: In([MSG]) }, take: 1 })
        expect(fake?.callsOf("values")).toEqual([[{ roomId: ROOM, messageId: MSG, workspaceId: WS, pinnedBy: ANA }]])
        expect(fake?.callsOf("orIgnore")).toEqual([[]])
        expect(em.delete).toHaveBeenCalledWith(ChatRoomPinEntity, { roomId: ROOM, messageId: MSG })
    })
})

describe("TeamChatStoreService cards", () => {
    it("stores a report card under its run, and answers the card already there for a repeat or none when nothing holds it", async () => {
        const em = mockEntityManager({})
        const [written, , found, , missing] = queueQueryBuilders(em, [
            { execute: { raw: [{ id: MSG }] } },
            { execute: { raw: [] } },
            { getMany: [message] },
            { execute: { raw: [] } },
            { getMany: [] },
        ])
        const store = await build(em)
        const card = { workspaceId: WS, roomId: ROOM, authorId: BOT, kind: "report" as const, refId: MSG, body: "done" }
        await expect(store.insertCard(card)).resolves.toEqual({ messageId: MSG, created: true })
        await expect(store.insertCard(card)).resolves.toEqual({ messageId: MSG, created: false })
        await expect(store.insertCard(card)).resolves.toBeNull()
        expect(written?.callsOf("values")[0]).toEqual([
            {
                roomId: ROOM,
                workspaceId: WS,
                authorKind: "agent",
                authorId: BOT,
                body: "done",
                kind: "report",
                ref: { run_id: MSG },
            },
        ])
        expect(found?.callsOf("where")[0]?.[1]).toEqual({ roomId: ROOM, kind: "report", key: "run_id", refId: MSG })
        expect(missing?.callsOf("limit")).toEqual([[1]])
    })

    it("stores an approval card of the system under its decision", async () => {
        const em = mockEntityManager({})
        const [written] = queueQueryBuilders(em, [{ execute: { raw: [{ id: MSG }] } }])
        const store = await build(em)
        const card = {
            workspaceId: WS,
            roomId: ROOM,
            authorId: null,
            kind: "approval" as const,
            refId: BEN,
            body: "ok?",
        }
        await expect(store.insertCard(card)).resolves.toEqual({ messageId: MSG, created: true })
        expect(written?.callsOf("values")[0]).toEqual([
            {
                roomId: ROOM,
                workspaceId: WS,
                authorKind: "system",
                authorId: null,
                body: "ok?",
                kind: "approval",
                ref: { decision_id: BEN },
            },
        ])
    })
})

describe("TeamChatStoreService card count", () => {
    it("counts the approval cards of a decision in the workspace", async () => {
        const em = mockEntityManager({})
        const [counted] = queueQueryBuilders(em, [{ getCount: 2 }])
        const store = await build(em)
        await expect(store.cardCount(WS, BEN)).resolves.toBe(2)
        expect(counted?.callsOf("where")[0]).toEqual([
            "msg.workspace_id = :workspaceId AND msg.kind = :kind AND (msg.ref ->> CAST(:key AS text)) = :decisionId",
            { workspaceId: WS, kind: "approval", key: "decision_id", decisionId: BEN },
        ])
    })
})

describe("TeamChatStoreService lines", () => {
    it("stores a line of an agent or of the system under its key, and answers none when the key already wrote it", async () => {
        const em = mockEntityManager({ findOne: [ChatRoomMessageEntity, message] })
        const [agent, system, repeat] = queueQueryBuilders(em, [
            { execute: { raw: [{ id: MSG }] } },
            { execute: { raw: [{ id: BEN }] } },
            { execute: { raw: [] } },
        ])
        const store = await build(em)
        const line = { workspaceId: WS, roomId: ROOM, authorAgentId: BOT, body: "hi", key: "k1" }
        await expect(store.insertLine(line)).resolves.toBe(MSG)
        await expect(store.insertLine({ ...line, authorAgentId: null })).resolves.toBe(BEN)
        await expect(store.insertLine(line)).resolves.toBeNull()
        expect(agent?.callsOf("values")[0]).toEqual([
            {
                roomId: ROOM,
                workspaceId: WS,
                authorKind: "agent",
                authorId: BOT,
                body: "hi",
                kind: "text",
                ref: null,
                clientId: "k1",
                replyTo: null,
            },
        ])
        expect(system?.callsOf("values")[0]).toEqual([
            {
                roomId: ROOM,
                workspaceId: WS,
                authorKind: "system",
                authorId: null,
                body: "hi",
                kind: "system",
                ref: null,
                clientId: "k1",
                replyTo: null,
            },
        ])
        expect(repeat?.callsOf("orIgnore")).toEqual([[]])
    })

    it("finds the message an agent already wrote under a key, and none when there is none", async () => {
        const kept = await build(mockEntityManager({ findOne: [ChatRoomMessageEntity, message] }))
        await expect(kept.lineKept(ROOM, BOT, "k1")).resolves.toBe(MSG)
        const none = await build(mockEntityManager({ findOne: [ChatRoomMessageEntity, null] }))
        await expect(none.lineKept(ROOM, BOT, "k1")).resolves.toBeNull()
    })
})

describe("TeamChatStoreService rewriting the lines of a folded card", () => {
    it("changes the words and the structured content of the agent's lines under the client ids, in the workspace only, and answers how many", async () => {
        const em = mockEntityManager({ update: [ChatRoomMessageEntity, { affected: 2 }] })
        const store = await build(em)

        await expect(
            store.updateAgentLines(WS, ["k", "k#module"], { body: "again", agentMessage: "{}" }),
        ).resolves.toBe(2)

        expect(em.update).toHaveBeenCalledWith(
            ChatRoomMessageEntity,
            { workspaceId: WS, clientId: In(["k", "k#module"]), authorKind: "agent" },
            { body: "again", ref: { agent_message: "{}" } },
        )
    })
})
