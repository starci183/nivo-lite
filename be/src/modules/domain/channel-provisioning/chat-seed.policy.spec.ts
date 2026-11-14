import { Test } from "@nestjs/testing"
import { ConnectionsError } from "@modules/domain/connections"
import { CHAT_SEED_SCHEMA } from "./chat-seed.contracts"
import { instantsOf, readChatSeedRooms } from "./chat-seed.policy"

const SUBJECT = Symbol("chat-seed.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { instantsOf, readChatSeedRooms } }],
    }).compile()
    return moduleRef.get<typeof import("./chat-seed.policy")>(SUBJECT)
}

const ROOM_ID = "5eed0c4a-0000-4000-8000-000000000001"
const LINE = { key: "a-1", from: { role: "owner" }, day: "yesterday", time: "08:30", body: "line one" }
const textOf = (room: unknown): string =>
    JSON.stringify({ documents: [{ path: "data/chat.json", document: { schema: CHAT_SEED_SCHEMA, rooms: [room] } }] })
const ROOM = { id: ROOM_ID, name: "Room", members: [{ role: "owner" }, { agent: "sales" }], messages: [LINE] }

describe("readChatSeedRooms", () => {
    it("reads a room with its members and lines", async () => {
        const { readChatSeedRooms } = await build()
        expect(readChatSeedRooms(textOf(ROOM))).toEqual([{ ...ROOM, purpose: "group", module: null }])
    })

    it("reads an agent seat's right to post, absent as no right, and refuses one that is not a boolean", async () => {
        const { readChatSeedRooms } = await build()
        const members = [{ role: "owner" }, { agent: "sales", mayPost: true }]
        expect(readChatSeedRooms(textOf({ ...ROOM, members }))[0]?.members).toEqual(members)
        const wrong = [{ agent: "sales", mayPost: "yes" }]
        expect(() => readChatSeedRooms(textOf({ ...ROOM, members: wrong }))).toThrow(ConnectionsError)
    })

    it("reads the purpose of a room: the common room, or the room of one module that names its module", async () => {
        const { readChatSeedRooms } = await build()
        expect(readChatSeedRooms(textOf({ ...ROOM, purpose: "common" }))[0]).toMatchObject({
            purpose: "common",
            module: null,
        })
        expect(readChatSeedRooms(textOf({ ...ROOM, purpose: "module", module: "sales" }))[0]).toMatchObject({
            purpose: "module",
            module: "sales",
        })
        expect(() => readChatSeedRooms(textOf({ ...ROOM, purpose: "module" }))).toThrow(ConnectionsError)
        expect(() => readChatSeedRooms(textOf({ ...ROOM, purpose: "common", module: "sales" }))).toThrow(
            ConnectionsError,
        )
        expect(() => readChatSeedRooms(textOf({ ...ROOM, purpose: "lobby" }))).toThrow(ConnectionsError)
    })

    it("refuses a room id that is no uuid, a time that is no HH:MM and a line key given twice", async () => {
        const { readChatSeedRooms } = await build()
        expect(() => readChatSeedRooms(textOf({ ...ROOM, id: "room-1" }))).toThrow(ConnectionsError)
        expect(() => readChatSeedRooms(textOf({ ...ROOM, messages: [{ ...LINE, time: "25:00" }] }))).toThrow(
            ConnectionsError,
        )
        expect(() => readChatSeedRooms(textOf({ ...ROOM, messages: [LINE, LINE] }))).toThrow(ConnectionsError)
    })
})

describe("instantsOf", () => {
    const messages = [
        { ...LINE, from: { role: "owner" as const }, day: "yesterday" as const, time: "08:30" },
        { ...LINE, key: "a-2", from: { role: "owner" as const }, day: "today" as const, time: "23:00" },
    ]

    it("places a line on its day and time in the workspace's own zone", async () => {
        const { instantsOf } = await build()
        const now = new Date("2026-11-09T12:00:00Z")
        expect(instantsOf(messages, now, "Europe/London")[0]?.toISOString()).toBe("2026-11-08T08:30:00.000Z")
        expect(instantsOf(messages, new Date("2026-11-09T03:00:00Z"), "America/New_York")[0]?.toISOString()).toBe(
            "2026-11-07T13:30:00.000Z",
        )
    })

    it("places a line on its day and time in Asia/Ho_Chi_Minh, which is seven hours ahead of UTC", async () => {
        const { instantsOf } = await build()
        const now = new Date("2026-11-09T12:00:00Z")
        expect(instantsOf(messages, now, "Asia/Ho_Chi_Minh")[0]?.toISOString()).toBe("2026-11-08T01:30:00.000Z")
    })

    it("moves a line that would fall after now back to just before it, keeping the order", async () => {
        const { instantsOf } = await build()
        const now = new Date("2026-11-09T01:00:00Z")
        const [first, second] = instantsOf(messages, now, "Asia/Ho_Chi_Minh")
        expect(second?.toISOString()).toBe("2026-11-09T00:59:00.000Z")
        expect(first?.getTime()).toBeLessThan(second?.getTime() ?? 0)
    })
})
