import { TeamChatErrorCode } from "./errors/team-chat.error"
import { BODY_MAX, FILES_MAX, MENTIONS_MAX, PAGE_DEFAULT, PAGE_MAX } from "./team-chat.contracts"
import type { MemberRef } from "./team-chat.contracts"
import {
    cursorOf,
    directKeyOf,
    groupNameOf,
    pageSizeOf,
    positionOf,
    sendProblem,
    uniqueMembers,
} from "./team-chat.policy"

const ME: MemberRef = { memberKind: "user", memberId: "11111111-1111-4111-8111-111111111111" }
const BOT: MemberRef = { memberKind: "agent", memberId: "22222222-2222-4222-8222-222222222222" }
const YOU: MemberRef = { memberKind: "user", memberId: "33333333-3333-4333-8333-333333333333" }

describe("uniqueMembers", () => {
    it("keeps each member once in the order named and drops the excepted one", () => {
        expect(uniqueMembers([YOU, BOT, YOU, ME], ME)).toEqual([YOU, BOT])
        expect(uniqueMembers([YOU, YOU], null)).toEqual([YOU])
        expect(uniqueMembers([], null)).toEqual([])
    })

    it("tells a person from an agent that shares an id", () => {
        const agent: MemberRef = { memberKind: "agent", memberId: YOU.memberId }
        expect(uniqueMembers([YOU, agent], null)).toEqual([YOU, agent])
    })
})

describe("directKeyOf", () => {
    it("is the same key whoever asks and tells people from agents", () => {
        expect(directKeyOf(ME, BOT)).toBe(directKeyOf(BOT, ME))
        expect(directKeyOf(ME, BOT)).toBe(`agent:${BOT.memberId}|user:${ME.memberId}`)
        expect(directKeyOf(ME, YOU)).not.toBe(directKeyOf(ME, BOT))
    })
})

describe("groupNameOf", () => {
    it("trims a name and refuses an empty or a too long one", () => {
        expect(groupNameOf("  Sales  ")).toBe("Sales")
        expect(groupNameOf("x".repeat(80))).toBe("x".repeat(80))
        expect(groupNameOf("x".repeat(81))).toBeNull()
        expect(groupNameOf("   ")).toBeNull()
        expect(groupNameOf(null)).toBeNull()
    })
})

describe("sendProblem", () => {
    it("names what is wrong with a message, the body first", () => {
        expect(sendProblem("hi", 0, 0)).toBeNull()
        expect(sendProblem("x".repeat(BODY_MAX + 1), 0, 0)).toBe(TeamChatErrorCode.BodyTooLong)
        expect(sendProblem("hi", MENTIONS_MAX + 1, 0)).toBe(TeamChatErrorCode.TooManyMentions)
        expect(sendProblem("hi", 0, FILES_MAX + 1)).toBe(TeamChatErrorCode.TooManyFiles)
        expect(sendProblem("  ", 0, 0)).toBe(TeamChatErrorCode.BodyEmpty)
        expect(sendProblem("", 0, 1)).toBeNull()
    })
})

describe("pageSizeOf", () => {
    it("defaults, floors at one and caps at the maximum", () => {
        expect(pageSizeOf(null)).toBe(PAGE_DEFAULT)
        expect(pageSizeOf(undefined)).toBe(PAGE_DEFAULT)
        expect(pageSizeOf(0)).toBe(1)
        expect(pageSizeOf(7.9)).toBe(7)
        expect(pageSizeOf(PAGE_MAX + 50)).toBe(PAGE_MAX)
    })
})

describe("cursors", () => {
    const position = { at: "2026-11-06T10:00:00.123456Z", id: "44444444-4444-4444-8444-444444444444" }

    it("round-trips a position", () => {
        expect(positionOf(cursorOf(position))).toEqual(position)
    })

    it("refuses what this module did not write", () => {
        expect(positionOf("garbage")).toBeNull()
        expect(positionOf(Buffer.from("2026-11-06T10:00:00Z|x", "utf8").toString("base64url"))).toBeNull()
        expect(positionOf(Buffer.from(`${position.at}|${position.id}|extra`, "utf8").toString("base64url"))).toBeNull()
        expect(positionOf(Buffer.from("", "utf8").toString("base64url"))).toBeNull()
    })
})
