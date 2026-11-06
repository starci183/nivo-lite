import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { FindOperator } from "typeorm"
import { AgentDirectoryService } from "@modules/domain/agents"
import { WorkspaceMemberSeatsService, WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { TeamChatErrorCode } from "./errors/team-chat.error"
import { ChatRoomEntity, ChatRoomMemberEntity, ChatRoomMessageEntity, ChatRoomPinEntity } from "./persistence/entities"
import { TeamChatFilesService } from "./team-chat-files.service"
import { TEAM_CHAT_TAGS } from "./team-chat.decorators"
import type { TeamChatTags } from "./team-chat.port"
import { TeamChatService } from "./team-chat.service"
import { cursorOf } from "./team-chat.policy"
import type { SendInput } from "./team-chat.contracts"

const WS = "11111111-1111-4111-8111-111111111111"
const OWNER = "21111111-1111-4111-8111-111111111111"
const ANA = "22222222-1111-4111-8111-111111111111"
const BEN = "23333333-1111-4111-8111-111111111111"
const CAL = "24444444-1111-4111-8111-111111111111"
const BOT = "31111111-1111-4111-8111-111111111111"
const ROOM = "41111111-1111-4111-8111-111111111111"
const DIRECT = "42222222-1111-4111-8111-111111111111"
const MSG = "51111111-1111-4111-8111-111111111111"
const MSG2 = "52222222-1111-4111-8111-111111111111"
const RUN = "61111111-1111-4111-8111-111111111111"
const DECISION = "71111111-1111-4111-8111-111111111111"
const AT = new Date("2026-11-06T10:00:00.000Z")

type Row = Record<string, unknown>
type Table = Array<Row>

/** An in-memory stand-in for the entity manager: the tables the chat reads and writes, and the SQL statements it sends, scripted by their first words. */
class FakeManager {
    rooms: Table = []
    members: Table = []
    messages: Table = []
    pins: Table = []
    approvals: Table = []
    inserts: Array<{ entity: string; values: unknown }> = []
    queries: Array<{ sql: string; params: ReadonlyArray<unknown> }> = []
    /** Answers by a fragment of the SQL; the first fragment that matches answers. */
    answers: Array<[string, (params: ReadonlyArray<unknown>) => unknown]> = []
    /** Failures to throw on the next insert of an entity name. */
    failInsert = new Map<string, unknown>()
    /** The rows the room list query answers. */
    roomRows: Array<Row> = []
    builderCalls: Array<string> = []
    seq = 0

    private tableOf(entity: unknown): Table {
        if (entity === ChatRoomEntity) return this.rooms
        if (entity === ChatRoomMemberEntity) return this.members
        if (entity === ChatRoomMessageEntity) return this.messages
        if (entity === ChatRoomPinEntity) return this.pins
        return this.approvals
    }

    private nameOf(entity: unknown): string {
        return entity === ChatRoomEntity
            ? "room"
            : entity === ChatRoomMemberEntity
              ? "member"
              : entity === ChatRoomMessageEntity
                ? "message"
                : "pin"
    }

    private matches(row: Row, where: Row): boolean {
        return Object.entries(where).every(([key, expected]) => {
            if (expected instanceof FindOperator) {
                if (expected.type === "in") return Array.isArray(expected.value) && expected.value.includes(row[key])
                return row[key] === null || row[key] === undefined
            }
            return row[key] === expected
        })
    }

    find(entity: unknown, options: { where: Row }): Promise<Table> {
        return Promise.resolve(this.tableOf(entity).filter((row) => this.matches(row, options.where)))
    }

    findOne(entity: unknown, options: { where: Row }): Promise<Row | null> {
        return Promise.resolve(this.tableOf(entity).find((row) => this.matches(row, options.where)) ?? null)
    }

    async findOneOrFail(entity: unknown, options: { where: Row }): Promise<Row> {
        const found = await this.findOne(entity, options)
        if (found === null) throw new Error("not found")
        return found
    }

    insert(entity: unknown, values: Row | Array<Row>): Promise<{ identifiers: Array<{ id: string }> }> {
        const failure = this.failInsert.get(this.nameOf(entity))
        if (failure !== undefined) {
            this.failInsert.delete(this.nameOf(entity))
            return Promise.reject(failure)
        }
        this.inserts.push({ entity: this.nameOf(entity), values })
        const list = Array.isArray(values) ? values : [values]
        const identifiers = list.map((value) => {
            this.seq += 1
            const id = `00000000-0000-4000-8000-${String(this.seq).padStart(12, "0")}`
            this.tableOf(entity).push({
                id,
                createdAt: AT,
                updatedAt: AT,
                editedAt: null,
                muted: false,
                mentions: [],
                attachments: [],
                ref: null,
                position: 0,
                ...Object.fromEntries(
                    Object.entries(value).map(([key, field]) => [
                        key,
                        typeof field === "function" ? Reflect.apply(field, undefined, []) : field,
                    ]),
                ),
            })
            return { id }
        })
        return Promise.resolve({ identifiers })
    }

    update(entity: unknown, where: Row, set: Row): Promise<{ affected: number }> {
        const hit = this.tableOf(entity).filter((row) => this.matches(row, where))
        hit.forEach((row) => Object.assign(row, set))
        return Promise.resolve({ affected: hit.length })
    }

    delete(entity: unknown, where: Row): Promise<void> {
        const table = this.tableOf(entity)
        const keep = table.filter((row) => !this.matches(row, where))
        table.splice(0, table.length, ...keep)
        return Promise.resolve()
    }

    transaction<T>(work: (manager: FakeManager) => Promise<T>): Promise<T> {
        return work(this)
    }

    query(sql: string, params: ReadonlyArray<unknown> = []): Promise<unknown> {
        this.queries.push({ sql, params })
        const answer = this.answers.find(([fragment]) => sql.includes(fragment))
        return Promise.resolve(answer === undefined ? [] : answer[1](params))
    }

    createQueryBuilder(entity?: unknown): unknown {
        const chain: Record<string, unknown> = {}
        const record =
            (name: string) =>
            (...args: ReadonlyArray<unknown>) => {
                this.builderCalls.push(
                    `${name}:${args.map((arg) => (typeof arg === "string" ? arg.slice(0, 24) : typeof arg)).join(",")}`,
                )
                return chain
            }
        for (const name of [
            "where",
            "andWhere",
            "orderBy",
            "addOrderBy",
            "take",
            "insert",
            "into",
            "values",
            "orIgnore",
        ])
            chain[name] = record(name)
        chain["getMany"] = () => Promise.resolve(this.roomRows)
        chain["execute"] = () => {
            this.pins.push({ roomId: "x" })
            return Promise.resolve({})
        }
        void entity
        return chain
    }
}

const room = (extra: Row = {}): Row => ({
    id: ROOM,
    workspaceId: WS,
    kind: "group",
    name: "Team",
    position: 0,
    directKey: null,
    createdBy: OWNER,
    createdAt: AT,
    ...extra,
})
const seat = (userId: string, roomId: string, role = "member", extra: Row = {}): Row => ({
    roomId,
    workspaceId: WS,
    memberKind: "user",
    memberId: userId,
    role,
    lastReadAt: AT,
    muted: false,
    ...extra,
})
const message = (id: string, extra: Row = {}): Row => ({
    id,
    roomId: ROOM,
    workspaceId: WS,
    authorKind: "user",
    authorId: ANA,
    body: "hello",
    kind: "text",
    ref: null,
    mentions: [],
    attachments: [],
    clientId: null,
    createdAt: AT,
    editedAt: null,
    ...extra,
})

const build = async () => {
    const manager = new FakeManager()
    const seats = mock<WorkspaceMemberSeatsService>()
    const people = mock<WorkspaceMembersReadService>()
    const agents = mock<AgentDirectoryService>()
    const files = mock<TeamChatFilesService>()
    const tags = mock<TeamChatTags>()
    seats.activeSeatOfUser.mockImplementation((_ws, userId) =>
        Promise.resolve(
            userId === OWNER
                ? { memberId: "seat-owner", userId, role: "owner", displayName: "Owner", status: "active" }
                : { memberId: `seat-${userId}`, userId, role: "staff", displayName: "Staff", status: "active" },
        ),
    )
    seats.activeUsers.mockResolvedValue([OWNER, ANA, BEN, CAL].map((userId) => ({ userId, displayName: userId })))
    people.namesOf.mockImplementation((_ws, ids) =>
        Promise.resolve(
            ids
                .filter((userId) => [OWNER, ANA, BEN, CAL].includes(userId))
                .map((userId) => ({ userId, displayName: `name-${userId.slice(0, 2)}` })),
        ),
    )
    agents.activeInOrder.mockImplementation((_ws, ids) =>
        Promise.resolve(
            ids.filter((id) => id === BOT).map((id) => ({ id, name: "Bot", module: "chatbot", canTagAgentIds: [] })),
        ),
    )
    agents.idsOfModule.mockResolvedValue([BOT])
    files.verify.mockResolvedValue({ ok: true, value: [] })
    files.urlsOf.mockResolvedValue(new Map())
    const moduleRef = await Test.createTestingModule({
        providers: [
            TeamChatService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: manager },
            { provide: WorkspaceMemberSeatsService, useValue: seats },
            { provide: WorkspaceMembersReadService, useValue: people },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: TeamChatFilesService, useValue: files },
            { provide: TEAM_CHAT_TAGS, useValue: tags },
        ],
    }).compile()
    const bare = await Test.createTestingModule({
        providers: [
            TeamChatService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: manager },
            { provide: WorkspaceMemberSeatsService, useValue: seats },
            { provide: WorkspaceMembersReadService, useValue: people },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: TeamChatFilesService, useValue: files },
        ],
    }).compile()
    return {
        chat: moduleRef.get(TeamChatService),
        withoutTags: bare.get(TeamChatService),
        manager,
        seats,
        people,
        agents,
        files,
        tags,
    }
}

const refusal = (result: { ok: boolean; refusal?: unknown }): unknown => (result.ok ? null : result.refusal)

describe("TeamChatService rooms and room", () => {
    it("lists the rooms the viewer sits in, newest message first, with members, unread, the viewer's mute and the last message", async () => {
        const { chat, manager } = await build()
        manager.rooms.push(room(), room({ id: DIRECT, kind: "direct", name: null, position: 2, createdAt: AT }))
        manager.members.push(seat(ANA, ROOM, "owner", { muted: true }), seat(BEN, ROOM), seat(ANA, DIRECT), {
            ...seat(BOT, DIRECT),
            memberKind: "agent",
        })
        manager.messages.push(message(MSG, { roomId: DIRECT, createdAt: new Date("2026-11-06T11:00:00.000Z") }))
        manager.roomRows = [...manager.rooms]
        manager.answers.push(
            ["count(msg.id)", () => [{ room_id: ROOM, unread: "2", mentions: "1" }]],
            ["DISTINCT ON (room_id)", () => [{ id: MSG }]],
        )
        const listed = await chat.rooms(WS, ANA, "group", BEN)
        expect(listed.map((view) => view.id)).toEqual([DIRECT, ROOM])
        const group = listed.find((view) => view.id === ROOM)
        expect(group).toMatchObject({ name: "Team", unreadCount: 2, mentionCount: 1, muted: true, lastMessage: null })
        expect(group?.members.map((member) => member.role)).toEqual(["owner", "member"])
        const direct = listed.find((view) => view.id === DIRECT)
        expect(direct).toMatchObject({ name: "Bot", unreadCount: 0, muted: false })
        expect(direct?.lastMessage?.body).toBe("hello")
        expect(manager.builderCalls.some((call) => call.startsWith("andWhere:room.kind"))).toBe(true)
    })

    it("lists every room for an owner without a kind or a member, and an empty list for no room", async () => {
        const { chat, manager } = await build()
        expect(await chat.rooms(WS, OWNER, null)).toEqual([])
        expect(manager.builderCalls.filter((call) => call.startsWith("andWhere:TRUE")).length).toBe(3)
    })

    it("puts rooms with a message before rooms without, the newest first, and the rest by position", async () => {
        const { chat, manager } = await build()
        const earlier = new Date("2026-11-06T09:00:00.000Z")
        manager.rooms.push(
            room({ id: "r1", position: 3 }),
            room({ id: "r2", position: 2 }),
            room({ id: "r3", position: 1 }),
            room({ id: "r4", position: 0 }),
        )
        ;["r1", "r2", "r3", "r4"].forEach((id) => manager.members.push(seat(ANA, id)))
        manager.messages.push(
            message("m-r2", { roomId: "r2", createdAt: earlier }),
            message("m-r3", { roomId: "r3", createdAt: AT }),
        )
        manager.roomRows = [...manager.rooms]
        manager.answers.push(["DISTINCT ON (room_id)", () => [{ id: "m-r2" }, { id: "m-r3" }]])
        const listed = await chat.rooms(WS, ANA, null)
        expect(listed.map((view) => view.id)).toEqual(["r3", "r2", "r4", "r1"])
        manager.roomRows = [...manager.rooms].reverse()
        expect((await chat.rooms(WS, ANA, null)).map((view) => view.id)).toEqual(["r3", "r2", "r4", "r1"])
    })

    it("sorts rooms with no message by their position and shows an empty name for a direct room whose other member is gone", async () => {
        const { chat, manager } = await build()
        manager.rooms.push(
            room({ id: "a", position: 5, name: null }),
            room({ id: "b", position: 1, kind: "direct", name: null }),
        )
        manager.members.push(seat(ANA, "a"), seat(ANA, "b"))
        manager.roomRows = [...manager.rooms]
        const listed = await chat.rooms(WS, ANA, null)
        expect(listed.map((view) => [view.id, view.name])).toEqual([
            ["b", ""],
            ["a", ""],
        ])
    })

    it("answers one room to a member or an owner, and null for a stranger or a room that is not there", async () => {
        const { chat, manager } = await build()
        manager.rooms.push(room())
        manager.members.push(seat(ANA, ROOM))
        expect((await chat.room(WS, ANA, ROOM))?.id).toBe(ROOM)
        expect((await chat.room(WS, OWNER, ROOM))?.id).toBe(ROOM)
        expect(await chat.room(WS, BEN, ROOM)).toBeNull()
        expect(await chat.room(WS, ANA, "missing")).toBeNull()
    })

    it("answers null when no view can be built for a room the viewer sees", async () => {
        const { chat, manager } = await build()
        manager.rooms.push(room())
        manager.members.push(seat(ANA, ROOM))
        Object.defineProperty(chat, "roomViews", { value: () => Promise.resolve([]) })
        expect(await chat.room(WS, ANA, ROOM)).toBeNull()
    })
})

describe("TeamChatService messages and unread", () => {
    const thread = (ids: Array<string>) => (): Array<{ id: string; at: string }> =>
        ids.map((id, index) => ({ id, at: `2026-11-06T10:00:0${String(index)}.000000Z` }))

    it("pages a thread newest first with a cursor, the pinned marked and the names resolved", async () => {
        const { chat, manager } = await build()
        manager.rooms.push(room())
        manager.members.push(seat(ANA, ROOM))
        manager.messages.push(
            message(MSG, {
                authorId: BOT,
                authorKind: "agent",
                mentions: [{ kind: "user", id: ANA }],
                attachments: [{ fileKey: "k", name: "n.pdf", mimeType: "application/pdf", sizeBytes: 3 }],
            }),
            message(MSG2),
        )
        manager.pins.push({ roomId: ROOM, messageId: MSG })
        manager.answers.push(["FROM public.chat_room_messages msg", thread([MSG, MSG2])])
        const page = await chat.messages(WS, ANA, ROOM, 1, null, false)
        expect(page.nodes.map((node) => node.id)).toEqual([MSG])
        expect(page.hasNextPage).toBe(true)
        expect(page.endCursor).toBe(cursorOf({ at: "2026-11-06T10:00:00.000000Z", id: MSG }))
        expect(page.nodes[0]).toMatchObject({
            pinned: true,
            authorName: "Bot",
            attachments: [{ fileKey: "k", url: "" }],
        })
        const last = await chat.messages(WS, ANA, ROOM, null, null, true)
        expect(last).toMatchObject({ hasNextPage: false, endCursor: null })
        expect(last.nodes.map((node) => node.id)).toEqual([MSG, MSG2])
    })

    it("shows an empty name for an author, a mention or a member the workspace no longer knows, and no run for a report that names none", async () => {
        const { chat, manager } = await build()
        manager.rooms.push(room())
        manager.members.push(seat(ANA, ROOM), { ...seat("ghost", ROOM), memberKind: "agent" })
        manager.messages.push(
            message(MSG, { authorId: "ghost", mentions: [{ kind: "user", id: "ghost-too" }] }),
            message(MSG2, { kind: "report", ref: {}, authorKind: "agent", authorId: BOT }),
        )
        manager.answers.push([
            "FROM public.chat_room_messages msg",
            () => [MSG, MSG2].map((id) => ({ id, at: "2026-11-06T10:00:00.000000Z" })),
        ])
        const page = await chat.messages(WS, ANA, ROOM, 10, null, false)
        expect(page.nodes[0]).toMatchObject({ authorName: "", mentions: [{ name: "" }] })
        expect(page.nodes[1]).toMatchObject({ kind: "report", runId: null })
        const view = await chat.room(WS, ANA, ROOM)
        expect(view?.members.map((member) => member.name)).toContain("")
    })

    it("answers an empty page for a room the viewer may not see and for a cursor that is not one", async () => {
        const { chat, manager } = await build()
        manager.rooms.push(room())
        manager.members.push(seat(ANA, ROOM))
        const empty = { nodes: [], hasNextPage: false, endCursor: null }
        expect(await chat.messages(WS, BEN, ROOM, 5, null, false)).toEqual(empty)
        expect(await chat.messages(WS, ANA, ROOM, 5, "garbage", false)).toEqual(empty)
    })

    it("passes a cursor position to the query", async () => {
        const { chat, manager } = await build()
        manager.rooms.push(room())
        manager.members.push(seat(ANA, ROOM))
        await chat.messages(WS, ANA, ROOM, 5, cursorOf({ at: "2026-11-06T10:00:00.000000Z", id: MSG }), false)
        expect(manager.queries[0]?.params.slice(2, 4)).toEqual(["2026-11-06T10:00:00.000000Z", MSG])
    })

    it("sums what is unread and lists only the rooms with something unread", async () => {
        const { chat, manager } = await build()
        manager.answers.push([
            "count(msg.id)",
            () => [
                { room_id: "a", unread: "2", mentions: "1" },
                { room_id: "b", unread: "0", mentions: "0" },
            ],
        ])
        expect(await chat.unread(WS, ANA)).toEqual({
            total: 2,
            mentionTotal: 1,
            rooms: [{ roomId: "a", unreadCount: 2, mentionCount: 1 }],
        })
    })
})

describe("TeamChatService createRoom", () => {
    it("opens a group with the creator as owner and the others as members", async () => {
        const { chat, manager } = await build()
        const result = await chat.createRoom(WS, OWNER, {
            kind: "group",
            name: " Ops ",
            members: [
                { memberKind: "user", memberId: ANA },
                { memberKind: "agent", memberId: BOT },
            ],
        })
        expect(result.ok && result.value).toMatchObject({ kind: "group", name: "Ops" })
        const roles = manager.members.map((row) => row["role"])
        expect(roles).toEqual(["owner", "member", "member"])
    })

    it("reads the room it just opened as its creator when the creator view comes back empty", async () => {
        const { chat, manager } = await build()
        Object.defineProperty(chat, "room", { value: () => Promise.resolve(null) })
        const result = await chat.createRoom(WS, OWNER, { kind: "group", name: "Quiet", members: [] })
        expect(result.ok && result.value.name).toBe("Quiet")
        expect(manager.rooms).toHaveLength(1)
    })

    it("opens a direct room once per pair and answers the existing one the second time", async () => {
        const { chat, manager } = await build()
        const first = await chat.createRoom(WS, OWNER, {
            kind: "direct",
            name: null,
            members: [{ memberKind: "user", memberId: ANA }],
        })
        const again = await chat.createRoom(WS, OWNER, {
            kind: "direct",
            name: null,
            members: [{ memberKind: "user", memberId: ANA }],
        })
        expect(first.ok && again.ok && first.value.id === again.value.id).toBe(true)
        expect(manager.rooms).toHaveLength(1)
    })

    it("refuses a bad shape, an unknown member, as data", async () => {
        const { chat, agents } = await build()
        const ana = { memberKind: "user", memberId: ANA } as const
        expect(refusal(await chat.createRoom(WS, OWNER, { kind: "direct", name: null, members: [] }))).toBe(
            TeamChatErrorCode.DirectNeedsTwo,
        )
        expect(refusal(await chat.createRoom(WS, OWNER, { kind: "direct", name: "no", members: [ana] }))).toBe(
            TeamChatErrorCode.DirectNeedsTwo,
        )
        expect(refusal(await chat.createRoom(WS, OWNER, { kind: "group", name: " ", members: [ana] }))).toBe(
            TeamChatErrorCode.GroupNeedsName,
        )
        expect(
            refusal(
                await chat.createRoom(WS, OWNER, {
                    kind: "group",
                    name: "x",
                    members: [{ memberKind: "user", memberId: "stranger" }],
                }),
            ),
        ).toBe(TeamChatErrorCode.MemberUnknown)
        agents.activeInOrder.mockResolvedValue([])
        expect(
            refusal(
                await chat.createRoom(WS, OWNER, {
                    kind: "group",
                    name: "x",
                    members: [{ memberKind: "agent", memberId: BOT }],
                }),
            ),
        ).toBe(TeamChatErrorCode.MemberUnknown)
    })

    it("finds the room the other person opened first when two open the same direct room at once, and fails on any other error", async () => {
        const { chat, manager } = await build()
        manager.rooms.push(room({ id: DIRECT, kind: "direct", name: null, directKey: `user:${OWNER}|user:${ANA}` }))
        manager.members.push(seat(OWNER, DIRECT, "owner"))
        const original = manager.findOne.bind(manager)
        let calls = 0
        jest.spyOn(manager, "findOne").mockImplementation((entity, options) => {
            calls += 1
            return calls === 1 ? Promise.resolve(null) : original(entity, options)
        })
        manager.failInsert.set("room", { code: "23505" })
        const raced = await chat.createRoom(WS, OWNER, {
            kind: "direct",
            name: null,
            members: [{ memberKind: "user", memberId: ANA }],
        })
        expect(raced.ok && raced.value.id).toBe(DIRECT)
        manager.failInsert.set("room", new Error("db down"))
        await expect(chat.createRoom(WS, OWNER, { kind: "group", name: "g", members: [] })).rejects.toThrow("db down")
        manager.failInsert.set("room", { code: "23505" })
        await expect(chat.createRoom(WS, OWNER, { kind: "group", name: "g", members: [] })).rejects.toMatchObject({
            code: "23505",
        })
    })
})

describe("TeamChatService members", () => {
    it("adds a member to a group, and refuses a stranger, a direct room, a non-manager, an unknown member and a member who is in", async () => {
        const { chat, manager, agents } = await build()
        manager.rooms.push(room(), room({ id: DIRECT, kind: "direct", name: null }))
        manager.members.push(seat(ANA, ROOM, "owner"), seat(BEN, ROOM), seat(OWNER, DIRECT))
        expect((await chat.addMember(WS, ANA, ROOM, { memberKind: "user", memberId: CAL })).ok).toBe(true)
        expect(refusal(await chat.addMember(WS, CAL, "gone", { memberKind: "user", memberId: ANA }))).toBe(
            TeamChatErrorCode.NotFound,
        )
        expect(refusal(await chat.addMember(WS, OWNER, DIRECT, { memberKind: "user", memberId: ANA }))).toBe(
            TeamChatErrorCode.Forbidden,
        )
        expect(refusal(await chat.addMember(WS, BEN, ROOM, { memberKind: "user", memberId: ANA }))).toBe(
            TeamChatErrorCode.Forbidden,
        )
        expect(refusal(await chat.addMember(WS, ANA, ROOM, { memberKind: "user", memberId: "stranger" }))).toBe(
            TeamChatErrorCode.MemberUnknown,
        )
        expect(refusal(await chat.addMember(WS, ANA, ROOM, { memberKind: "user", memberId: BEN }))).toBe(
            TeamChatErrorCode.AlreadyMember,
        )
        agents.activeInOrder.mockResolvedValue([])
        expect(refusal(await chat.addMember(WS, OWNER, ROOM, { memberKind: "agent", memberId: BOT }))).toBe(
            TeamChatErrorCode.MemberUnknown,
        )
    })

    it("removes a member, lets a member leave, deletes the room with its last member and keeps the last owner", async () => {
        const { chat, manager } = await build()
        manager.rooms.push(room(), room({ id: DIRECT, kind: "direct", name: null }))
        manager.members.push(seat(ANA, ROOM, "owner"), seat(BEN, ROOM), seat(OWNER, DIRECT))
        expect(refusal(await chat.removeMember(WS, CAL, "gone", { memberKind: "user", memberId: BEN }))).toBe(
            TeamChatErrorCode.NotFound,
        )
        expect(refusal(await chat.removeMember(WS, OWNER, DIRECT, { memberKind: "user", memberId: OWNER }))).toBe(
            TeamChatErrorCode.Forbidden,
        )
        expect(refusal(await chat.removeMember(WS, BEN, ROOM, { memberKind: "user", memberId: ANA }))).toBe(
            TeamChatErrorCode.Forbidden,
        )
        expect(refusal(await chat.removeMember(WS, ANA, ROOM, { memberKind: "user", memberId: CAL }))).toBe(
            TeamChatErrorCode.NotAMemberToRemove,
        )
        expect(refusal(await chat.removeMember(WS, ANA, ROOM, { memberKind: "agent", memberId: BEN }))).toBe(
            TeamChatErrorCode.NotAMemberToRemove,
        )
        expect(refusal(await chat.removeMember(WS, ANA, ROOM, { memberKind: "user", memberId: ANA }))).toBe(
            TeamChatErrorCode.LastOwner,
        )
        const left = await chat.removeMember(WS, BEN, ROOM, { memberKind: "user", memberId: BEN })
        expect(left.ok && left.value).toBeNull()
        const kicked = await chat.removeMember(WS, ANA, ROOM, { memberKind: "user", memberId: ANA })
        expect(kicked.ok && kicked.value).toBeNull()
        expect(manager.rooms.map((row) => row["id"])).toEqual([DIRECT])
    })

    it("keeps the owner when another owner remains, so one owner may leave", async () => {
        const { chat, manager } = await build()
        manager.rooms.push(room())
        manager.members.push(seat(ANA, ROOM, "owner"), seat(BEN, ROOM, "owner"), seat(CAL, ROOM))
        const left = await chat.removeMember(WS, ANA, ROOM, { memberKind: "user", memberId: ANA })
        expect(left.ok).toBe(true)
        expect(manager.members.map((row) => row["memberId"])).toEqual([BEN, CAL])
    })
})

describe("TeamChatService send", () => {
    const input = (extra: Partial<SendInput> = {}): SendInput => ({
        roomId: ROOM,
        to: null,
        body: "hello",
        mentions: [],
        fileKeys: [],
        clientId: null,
        ...extra,
    })

    it("stores a text message, tags the agents it mentions once and moves the author's read position", async () => {
        const { chat, manager, tags } = await build()
        manager.rooms.push(room())
        manager.members.push(seat(ANA, ROOM))
        const sent = await chat.send(
            WS,
            ANA,
            input({
                mentions: [
                    { memberKind: "agent", memberId: BOT },
                    { memberKind: "user", memberId: BEN },
                ],
                clientId: "c1",
            }),
        )
        expect(sent.ok && sent.value).toMatchObject({ kind: "text", authorId: ANA, roomId: ROOM })
        expect(tags.handOff).toHaveBeenCalledTimes(1)
        expect(tags.handOff).toHaveBeenCalledWith(
            WS,
            expect.objectContaining({ userId: ANA, agentId: BOT, roomId: ROOM }),
        )
        expect(
            manager.queries.some((query) => query.sql.includes("UPDATE public.chat_room_members SET last_read_at")),
        ).toBe(true)
    })

    it("answers the message of a retry and tags nothing, and works without a tag port", async () => {
        const { chat, manager, tags, withoutTags } = await build()
        manager.rooms.push(room())
        manager.members.push(seat(ANA, ROOM))
        manager.messages.push(message(MSG, { clientId: "c1" }))
        const retried = await chat.send(
            WS,
            ANA,
            input({ clientId: "c1", mentions: [{ memberKind: "agent", memberId: BOT }] }),
        )
        expect(retried.ok && retried.value.id).toBe(MSG)
        expect(tags.handOff).not.toHaveBeenCalled()
        const plain = await withoutTags.send(WS, ANA, input({ mentions: [{ memberKind: "agent", memberId: BOT }] }))
        expect(plain.ok).toBe(true)
    })

    it("opens the direct room for the first message to a member, and refuses with no room and nobody to open it to", async () => {
        const { chat, manager } = await build()
        const first = await chat.send(WS, ANA, input({ roomId: null, to: { memberKind: "user", memberId: BEN } }))
        expect(first.ok).toBe(true)
        expect(manager.rooms).toHaveLength(1)
        expect(refusal(await chat.send(WS, ANA, input({ roomId: null })))).toBe(TeamChatErrorCode.NotFound)
        expect(
            refusal(
                await chat.send(WS, ANA, input({ roomId: null, to: { memberKind: "user", memberId: "stranger" } })),
            ),
        ).toBe(TeamChatErrorCode.NotFound)
    })

    it("refuses a room the sender does not see, a bad body, an unknown mention and files that do not verify, as data", async () => {
        const { chat, manager, files } = await build()
        manager.rooms.push(room())
        manager.members.push(seat(ANA, ROOM))
        expect(refusal(await chat.send(WS, BEN, input()))).toBe(TeamChatErrorCode.NotFound)
        expect(refusal(await chat.send(WS, ANA, input({ body: "  " })))).toBe(TeamChatErrorCode.BodyEmpty)
        expect(
            refusal(await chat.send(WS, ANA, input({ mentions: [{ memberKind: "user", memberId: "stranger" }] }))),
        ).toBe(TeamChatErrorCode.MemberUnknown)
        files.verify.mockResolvedValue({ ok: false, refusal: TeamChatErrorCode.FileTooLarge })
        expect(refusal(await chat.send(WS, ANA, input({ fileKeys: ["k"] })))).toBe(TeamChatErrorCode.FileTooLarge)
    })

    it("keeps the files that verified as the attachments of the message", async () => {
        const { chat, manager, files } = await build()
        manager.rooms.push(room())
        manager.members.push(seat(ANA, ROOM))
        files.verify.mockResolvedValue({
            ok: true,
            value: [{ fileKey: "k", name: "n.pdf", mimeType: "application/pdf", sizeBytes: 3 }],
        })
        files.urlsOf.mockResolvedValue(new Map([["k", "https://get"]]))
        const sent = await chat.send(WS, ANA, input({ body: "", fileKeys: ["k"] }))
        expect(sent.ok && sent.value.attachments).toEqual([
            { fileKey: "k", name: "n.pdf", mimeType: "application/pdf", sizeBytes: 3, url: "https://get" },
        ])
    })

    it("finds the message that won the race on a unique violation, and fails on any other error", async () => {
        const { chat, manager } = await build()
        manager.rooms.push(room())
        manager.members.push(seat(ANA, ROOM))
        const original = manager.findOne.bind(manager)
        let looked = 0
        jest.spyOn(manager, "findOne").mockImplementation((entity, options) => {
            if (entity === ChatRoomMessageEntity) {
                looked += 1
                if (looked === 1) return Promise.resolve(null)
            }
            return original(entity, options)
        })
        manager.messages.push(message(MSG, { clientId: "c1" }))
        manager.failInsert.set("message", { code: "23505" })
        const raced = await chat.send(WS, ANA, input({ clientId: "c1" }))
        expect(raced.ok && raced.value.id).toBe(MSG)
        manager.failInsert.set("message", new Error("db down"))
        await expect(chat.send(WS, ANA, input({ clientId: "c2" }))).rejects.toThrow("db down")
        manager.failInsert.set("message", { code: "23505" })
        await expect(chat.send(WS, ANA, input({ clientId: null }))).rejects.toMatchObject({ code: "23505" })
    })
})

describe("TeamChatService upload, mute, read and pins", () => {
    it("asks the files for the address only for a person who sees the room", async () => {
        const { chat, manager, files } = await build()
        manager.rooms.push(room())
        manager.members.push(seat(ANA, ROOM))
        files.requestUpload.mockResolvedValue({
            ok: true,
            value: { fileKey: "k", uploadUrl: "u", method: "PUT", headers: [], expiresAt: AT },
        })
        const ask = { fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 1 }
        expect((await chat.requestUpload(WS, ANA, ROOM, ask)).ok).toBe(true)
        expect(refusal(await chat.requestUpload(WS, BEN, ROOM, ask))).toBe(TeamChatErrorCode.NotFound)
    })

    it("mutes a room for a member and refuses a stranger and an owner who has no seat in the room", async () => {
        const { chat, manager } = await build()
        manager.rooms.push(room())
        manager.members.push(seat(ANA, ROOM))
        const muted = await chat.setMuted(WS, ANA, ROOM, true)
        expect(muted.ok && muted.value.muted).toBe(true)
        expect(refusal(await chat.setMuted(WS, BEN, ROOM, true))).toBe(TeamChatErrorCode.NotFound)
        expect(refusal(await chat.setMuted(WS, OWNER, ROOM, true))).toBe(TeamChatErrorCode.NotMember)
    })

    it("moves the read position to a message or the newest, and refuses a stranger, an outsider owner and a message that is not in the room", async () => {
        const { chat, manager } = await build()
        manager.rooms.push(room())
        manager.members.push(seat(ANA, ROOM))
        manager.messages.push(message(MSG))
        manager.answers.push(["count(msg.id)", () => [{ room_id: ROOM, unread: "1", mentions: "0" }]])
        expect((await chat.markRead(WS, ANA, ROOM, MSG)).ok).toBe(true)
        const newest = await chat.markRead(WS, ANA, ROOM, null)
        expect(newest.ok && newest.value).toEqual({ roomId: ROOM, unreadCount: 1, mentionCount: 0 })
        expect(refusal(await chat.markRead(WS, BEN, ROOM, null))).toBe(TeamChatErrorCode.NotFound)
        expect(refusal(await chat.markRead(WS, OWNER, ROOM, null))).toBe(TeamChatErrorCode.NotMember)
        expect(refusal(await chat.markRead(WS, ANA, ROOM, MSG2))).toBe(TeamChatErrorCode.NotFound)
        manager.answers.length = 0
        const none = await chat.markRead(WS, ANA, ROOM, null)
        expect(none.ok && none.value).toEqual({ roomId: ROOM, unreadCount: 0, mentionCount: 0 })
    })

    it("pins and unpins a message of a room and refuses a stranger and a message that is not in it", async () => {
        const { chat, manager } = await build()
        manager.rooms.push(room())
        manager.members.push(seat(ANA, ROOM))
        manager.messages.push(message(MSG))
        expect((await chat.pin(WS, ANA, ROOM, MSG)).ok).toBe(true)
        expect(manager.builderCalls).toContain("orIgnore:")
        manager.pins.push({ roomId: ROOM, messageId: MSG })
        expect((await chat.unpin(WS, ANA, ROOM, MSG)).ok).toBe(true)
        expect(refusal(await chat.pin(WS, BEN, ROOM, MSG))).toBe(TeamChatErrorCode.NotFound)
        expect(refusal(await chat.unpin(WS, ANA, ROOM, MSG2))).toBe(TeamChatErrorCode.NotFound)
    })
})

describe("TeamChatService engine side", () => {
    it("writes the report of a run once, in the room the agent is configured to report to", async () => {
        const { chat, manager } = await build()
        manager.rooms.push(room())
        manager.answers.push(["INSERT INTO public.chat_room_messages", () => [{ id: MSG }]])
        const posted = await chat.postReport(WS, { runId: RUN, agentId: BOT, body: "Done", roomId: ROOM })
        expect(posted).toEqual({ roomId: ROOM, messageId: MSG, created: true })
    })

    it("finds the card it wrote when the report is posted again", async () => {
        const { chat, manager } = await build()
        manager.rooms.push(room())
        manager.messages.push(message(MSG, { kind: "report" }))
        const posted = await chat.postReport(WS, { runId: RUN, agentId: BOT, body: "Done", roomId: ROOM })
        expect(posted).toEqual({ roomId: ROOM, messageId: MSG, created: false })
    })

    it("reports in the direct room of the agent and the owner when no room is configured, and opens it on the write", async () => {
        const { chat, manager } = await build()
        manager.answers.push(
            ["SELECT owner_id", () => [{ owner_id: OWNER }]],
            ["INSERT INTO public.chat_room_messages", () => [{ id: MSG }]],
        )
        const posted = await chat.postReport(WS, { runId: RUN, agentId: BOT, body: "Done", roomId: "elsewhere" })
        expect(posted?.created).toBe(true)
        expect(manager.rooms).toHaveLength(1)
        const again = await chat.postReport(WS, { runId: RUN, agentId: BOT, body: "Done", roomId: null })
        expect(again?.roomId).toBe(posted?.roomId)
    })

    it("reports nowhere for a workspace without an owner and an agent that is not of the workspace", async () => {
        const { chat, manager, agents } = await build()
        expect(await chat.postReport(WS, { runId: RUN, agentId: BOT, body: "x", roomId: null })).toBeNull()
        manager.answers.push(["SELECT owner_id", () => [{ owner_id: OWNER }]])
        agents.activeInOrder.mockResolvedValue([])
        expect(await chat.postReport(WS, { runId: RUN, agentId: BOT, body: "x", roomId: null })).toBeNull()
    })

    it("posts the approval card to the rooms the rule names and the direct room of each named approver, once each", async () => {
        const { chat, manager, seats } = await build()
        manager.rooms.push(room())
        seats.seatsByIds.mockResolvedValue([
            { memberId: "seat-ben", userId: BEN, role: "staff", displayName: "Ben", status: "active" },
        ])
        manager.answers.push(["INSERT INTO public.chat_room_messages", () => [{ id: MSG }]])
        const count = await chat.postApproval(WS, {
            decisionId: DECISION,
            body: "Ask",
            agentId: BOT,
            roomIds: [ROOM],
            approverSeatIds: ["seat-ben"],
        })
        expect(count).toBe(2)
        const noAgent = await chat.postApproval(WS, {
            decisionId: DECISION,
            body: "Ask",
            agentId: null,
            roomIds: [],
            approverSeatIds: ["seat-ben"],
        })
        expect(noAgent).toBe(0)
        expect(manager.queries.some((query) => query.params[2] === "system")).toBe(false)
    })

    it("posts a system card when no agent asked, and skips an approver whose direct room cannot be opened", async () => {
        const { chat, manager, seats, agents } = await build()
        manager.rooms.push(room())
        manager.answers.push(["INSERT INTO public.chat_room_messages", () => [{ id: MSG }]])
        expect(
            await chat.postApproval(WS, {
                decisionId: DECISION,
                body: "Ask",
                agentId: null,
                roomIds: [ROOM],
                approverSeatIds: [],
            }),
        ).toBe(1)
        expect(manager.queries.at(-1)?.params[2]).toBe("system")
        seats.seatsByIds.mockResolvedValue([
            { memberId: "seat-x", userId: "stranger", role: "staff", displayName: "X", status: "active" },
        ])
        expect(
            await chat.postApproval(WS, {
                decisionId: DECISION,
                body: "Ask",
                agentId: BOT,
                roomIds: [],
                approverSeatIds: ["seat-x"],
            }),
        ).toBe(0)
        agents.activeInOrder.mockResolvedValue([])
    })

    it("writes a line of an agent to a named room or to one person, once per key, and a system line", async () => {
        const { chat, manager } = await build()
        manager.rooms.push(room())
        manager.members.push(seat(ANA, ROOM))
        manager.answers.push(["INSERT INTO public.chat_room_messages", () => [{ id: MSG }]])
        const named = await chat.postMessage(WS, {
            authorAgentId: BOT,
            roomId: ROOM,
            toUserId: null,
            body: " Hi ",
            key: "k1",
        })
        expect(named).toEqual({ roomId: ROOM, messageId: MSG })
        const toPerson = await chat.postMessage(WS, {
            authorAgentId: BOT,
            roomId: null,
            toUserId: ANA,
            body: "Private",
            key: null,
        })
        expect(toPerson?.messageId).toBe(MSG)
        const system = await chat.postMessage(WS, {
            authorAgentId: null,
            roomId: ROOM,
            toUserId: null,
            body: "Closed",
            key: null,
        })
        expect(system?.messageId).toBe(MSG)
        expect(manager.queries.map((query) => query.params[2])).toEqual(["agent", "agent", "system"])
    })

    it("writes nothing for a system line or a line without a key when the insert wrote nothing", async () => {
        const { chat, manager } = await build()
        manager.rooms.push(room())
        manager.answers.push(["INSERT INTO public.chat_room_messages", () => []])
        expect(
            await chat.postMessage(WS, { authorAgentId: null, roomId: ROOM, toUserId: null, body: "Closed", key: "k" }),
        ).toBeNull()
        expect(
            await chat.postMessage(WS, { authorAgentId: BOT, roomId: ROOM, toUserId: null, body: "Hi", key: null }),
        ).toBeNull()
    })

    it("finds the line a key already wrote, and writes nothing for nobody, an empty body or a room that is not there", async () => {
        const { chat, manager } = await build()
        manager.rooms.push(room())
        manager.messages.push(message(MSG, { authorKind: "agent", authorId: BOT, clientId: "k1" }))
        const same = await chat.postMessage(WS, {
            authorAgentId: BOT,
            roomId: ROOM,
            toUserId: null,
            body: "Hi",
            key: "k1",
        })
        expect(same).toEqual({ roomId: ROOM, messageId: MSG })
        expect(
            await chat.postMessage(WS, { authorAgentId: BOT, roomId: "gone", toUserId: null, body: "Hi", key: null }),
        ).toBeNull()
        expect(
            await chat.postMessage(WS, { authorAgentId: null, roomId: null, toUserId: ANA, body: "Hi", key: null }),
        ).toBeNull()
        expect(
            await chat.postMessage(WS, { authorAgentId: BOT, roomId: null, toUserId: null, body: "Hi", key: null }),
        ).toBeNull()
        expect(
            await chat.postMessage(WS, { authorAgentId: BOT, roomId: ROOM, toUserId: null, body: "  ", key: null }),
        ).toBeNull()
    })

    it("says a line as an agent named by id or by module key, to the owner by default, and nothing for an agent or a person that is not there", async () => {
        const { chat, manager, agents } = await build()
        manager.answers.push(
            ["SELECT owner_id", () => [{ owner_id: OWNER }]],
            ["INSERT INTO public.chat_room_messages", () => [{ id: MSG }]],
        )
        const byModule = await chat.postAsAgent(WS, { agent: "chatbot", toUserId: null, body: "Hello", key: null })
        expect(byModule).toEqual({ roomId: expect.any(String), messageId: MSG, agentId: BOT })
        const byId = await chat.postAsAgent(WS, { agent: BOT, toUserId: ANA, body: "Hello", key: "k" })
        expect(byId?.agentId).toBe(BOT)
        agents.idsOfModule.mockResolvedValue([])
        expect(await chat.postAsAgent(WS, { agent: "sales", toUserId: null, body: "x", key: null })).toBeNull()
        expect(
            await chat.postAsAgent(WS, {
                agent: "31111111-1111-4111-8111-111111111112",
                toUserId: null,
                body: "x",
                key: null,
            }),
        ).toBeNull()
        manager.answers.length = 0
        expect(await chat.postAsAgent(WS, { agent: BOT, toUserId: null, body: "x", key: null })).toBeNull()
        manager.answers.push(["SELECT owner_id", () => [{ owner_id: OWNER }]])
        expect(await chat.postAsAgent(WS, { agent: BOT, toUserId: "stranger", body: "x", key: null })).toBeNull()
    })
})

describe("TeamChatService decisions", () => {
    it("reads the request a card is about with the group it stored, and null for none", async () => {
        const { chat, manager } = await build()
        manager.answers.push([
            "FROM public.approval_requests WHERE workspace_id",
            (params) =>
                params[1] === DECISION
                    ? [
                          {
                              id: DECISION,
                              action: "refund",
                              amount: "200000",
                              unit: "vnd",
                              agent: BOT,
                              stored_group: { rooms: [] },
                          },
                      ]
                    : [],
        ])
        expect(await chat.approvalRequest(WS, DECISION)).toEqual({
            id: DECISION,
            action: "refund",
            amount: 200000,
            unit: "vnd",
            requestedByAgentId: BOT,
            storedGroup: { rooms: [] },
        })
        expect(await chat.approvalRequest(WS, "other")).toBeNull()
        manager.answers.length = 0
        manager.answers.push([
            "FROM public.approval_requests WHERE workspace_id",
            () => [{ id: DECISION, action: "x", amount: null, unit: "vnd", agent: null, stored_group: null }],
        ])
        expect((await chat.approvalRequest(WS, DECISION))?.amount).toBeNull()
    })

    it("shows where a decision stands for the viewer: pending and decidable by an approver, refused with who settled it, none for no card", async () => {
        const { chat, manager } = await build()
        manager.answers.push([
            "FROM public.approval_requests r LEFT JOIN",
            () => [
                {
                    id: DECISION,
                    status: "pending",
                    resolved_at: null,
                    by_name: null,
                    approvers: [{ memberId: `seat-${ANA}` }, {}],
                },
                { id: MSG, status: "rejected", resolved_at: AT, by_name: "Lan", approvers: [] },
            ],
        ])
        const pending = await chat.approvalOf(WS, ANA, DECISION)
        expect(pending).toMatchObject({ status: "pending", canDecide: true, decidedByName: null })
        const refused = await chat.approvalOf(WS, ANA, MSG)
        expect(refused).toMatchObject({ status: "refused", canDecide: false, decidedByName: "Lan", decidedAt: AT })
        expect(await chat.approvalOf(WS, ANA, "other")).toBeNull()
    })

    it("shows a card with no decision as having no state, and a viewer with no seat as unable to decide", async () => {
        const { chat, manager, seats } = await build()
        manager.rooms.push(room())
        manager.members.push(seat(ANA, ROOM))
        manager.messages.push(
            message(MSG, { kind: "approval", ref: { decision_id: DECISION }, authorKind: "system", authorId: null }),
            message(MSG2, { kind: "approval", ref: {} }),
            message("m3", { kind: "report", ref: { run_id: RUN } }),
        )
        manager.answers.push(
            [
                "FROM public.chat_room_messages msg",
                () => [MSG, MSG2, "m3"].map((id) => ({ id, at: "2026-11-06T10:00:00.000000Z" })),
            ],
            [
                "FROM public.approval_requests r LEFT JOIN",
                () => [
                    {
                        id: DECISION,
                        status: "pending",
                        resolved_at: null,
                        by_name: null,
                        approvers: [{ memberId: "seat-x" }],
                    },
                ],
            ],
        )
        seats.activeSeatOfUser.mockResolvedValue(null)
        const page = await chat.messages(WS, ANA, ROOM, 10, null, false)
        const [card, bare, report] = page.nodes
        expect(card).toMatchObject({
            kind: "approval",
            decisionId: DECISION,
            authorName: "",
            approval: { canDecide: false },
        })
        expect(bare).toMatchObject({ decisionId: null, approval: null })
        expect(report).toMatchObject({ kind: "report", runId: RUN, decisionId: null })
    })
})
