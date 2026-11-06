import { Test } from "@nestjs/testing"
import { TeamChatErrorCode } from "./errors/team-chat.error"
import { BODY_MAX, FILES_MAX, MENTIONS_MAX, PAGE_DEFAULT, PAGE_MAX } from "./team-chat.contracts"
import type { ChatMemberRef } from "./team-chat.contracts"
import {
    CARD_BODY_MAX,
    cardBodyOf,
    chatDone,
    chatRefusal,
    cursorOf,
    directKeyOf,
    groupNameOf,
    isUniqueViolation,
    isUuid,
    pageSizeOf,
    positionOf,
    sendProblem,
    storedMentionsOf,
    uniqueMembers,
} from "./team-chat.policy"

const SUBJECT = Symbol("team-chat.policy")

const ME: ChatMemberRef = { memberKind: "user", memberId: "11111111-1111-4111-8111-111111111111" }
const BOT: ChatMemberRef = { memberKind: "agent", memberId: "22222222-2222-4222-8222-222222222222" }
const YOU: ChatMemberRef = { memberKind: "user", memberId: "33333333-3333-4333-8333-333333333333" }

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    cardBodyOf,
                    chatDone,
                    chatRefusal,
                    cursorOf,
                    directKeyOf,
                    groupNameOf,
                    isUniqueViolation,
                    isUuid,
                    pageSizeOf,
                    positionOf,
                    sendProblem,
                    storedMentionsOf,
                    uniqueMembers,
                },
            },
        ],
    }).compile()
    return moduleRef.get<{
        cardBodyOf: typeof cardBodyOf
        chatDone: typeof chatDone
        chatRefusal: typeof chatRefusal
        cursorOf: typeof cursorOf
        directKeyOf: typeof directKeyOf
        groupNameOf: typeof groupNameOf
        isUniqueViolation: typeof isUniqueViolation
        isUuid: typeof isUuid
        pageSizeOf: typeof pageSizeOf
        positionOf: typeof positionOf
        sendProblem: typeof sendProblem
        storedMentionsOf: typeof storedMentionsOf
        uniqueMembers: typeof uniqueMembers
    }>(SUBJECT)
}

describe("members and rooms", () => {
    it("keeps each member once in the order named and drops the excepted one", async () => {
        const subject = await buildSubject()
        expect(subject.uniqueMembers([YOU, BOT, YOU, ME], ME)).toEqual([YOU, BOT])
        expect(subject.uniqueMembers([YOU, YOU], null)).toEqual([YOU])
        expect(subject.uniqueMembers([], null)).toEqual([])
    })

    it("tells a person from an agent that shares an id", async () => {
        const subject = await buildSubject()
        const agent: ChatMemberRef = { memberKind: "agent", memberId: YOU.memberId }
        expect(subject.uniqueMembers([YOU, agent], null)).toEqual([YOU, agent])
    })

    it("makes the same direct key whoever asks, telling people from agents", async () => {
        const subject = await buildSubject()
        expect(subject.directKeyOf(ME, BOT)).toBe(subject.directKeyOf(BOT, ME))
        expect(subject.directKeyOf(ME, BOT)).toBe(`agent:${BOT.memberId}|user:${ME.memberId}`)
        expect(subject.directKeyOf(ME, YOU)).not.toBe(subject.directKeyOf(ME, BOT))
    })

    it("trims a group name and refuses an empty or a too long one", async () => {
        const subject = await buildSubject()
        expect(subject.groupNameOf("  Sales  ")).toBe("Sales")
        expect(subject.groupNameOf("x".repeat(80))).toBe("x".repeat(80))
        expect(subject.groupNameOf("x".repeat(81))).toBeNull()
        expect(subject.groupNameOf("   ")).toBeNull()
        expect(subject.groupNameOf(null)).toBeNull()
    })

    it("keeps the mentions as a message row stores them", async () => {
        const subject = await buildSubject()
        expect(subject.storedMentionsOf([ME, BOT])).toEqual([
            { kind: "user", id: ME.memberId },
            { kind: "agent", id: BOT.memberId },
        ])
    })
})

describe("messages", () => {
    it("names what is wrong with a message, the body first", async () => {
        const subject = await buildSubject()
        expect(subject.sendProblem("hi", 0, 0)).toBeNull()
        expect(subject.sendProblem("x".repeat(BODY_MAX + 1), 0, 0)).toBe(TeamChatErrorCode.BodyTooLong)
        expect(subject.sendProblem("hi", MENTIONS_MAX + 1, 0)).toBe(TeamChatErrorCode.TooManyMentions)
        expect(subject.sendProblem("hi", 0, FILES_MAX + 1)).toBe(TeamChatErrorCode.TooManyFiles)
        expect(subject.sendProblem("  ", 0, 0)).toBe(TeamChatErrorCode.BodyEmpty)
        expect(subject.sendProblem("", 0, 1)).toBeNull()
    })

    it("cuts a card body to what the database keeps", async () => {
        const subject = await buildSubject()
        expect(subject.cardBodyOf("short")).toBe("short")
        expect(subject.cardBodyOf("x".repeat(CARD_BODY_MAX + 5))).toHaveLength(CARD_BODY_MAX)
    })

    it("answers data for a refusal and a success", async () => {
        const subject = await buildSubject()
        expect(subject.chatRefusal(TeamChatErrorCode.NotFound)).toEqual({ ok: false, refusal: "TEAM_CHAT_NOT_FOUND" })
        expect(subject.chatDone(3)).toEqual({ ok: true, value: 3 })
    })

    it("tells a unique violation from any other failure", async () => {
        const subject = await buildSubject()
        expect(subject.isUniqueViolation({ code: "23505" })).toBe(true)
        expect(subject.isUniqueViolation({ code: "23503" })).toBe(false)
        expect(subject.isUniqueViolation("23505")).toBe(false)
        expect(subject.isUniqueViolation(null)).toBe(false)
    })

    it("reads an id of either case and refuses a module key", async () => {
        const subject = await buildSubject()
        expect(subject.isUuid(ME.memberId.toUpperCase())).toBe(true)
        expect(subject.isUuid("sales")).toBe(false)
    })
})

describe("pages and cursors", () => {
    const position = { at: "2026-11-06T10:00:00.123456Z", id: "44444444-4444-4444-8444-444444444444" }

    it("defaults the page size, floors it at one and caps it at the maximum", async () => {
        const subject = await buildSubject()
        expect(subject.pageSizeOf(null)).toBe(PAGE_DEFAULT)
        expect(subject.pageSizeOf(undefined)).toBe(PAGE_DEFAULT)
        expect(subject.pageSizeOf(0)).toBe(1)
        expect(subject.pageSizeOf(7.9)).toBe(7)
        expect(subject.pageSizeOf(PAGE_MAX + 50)).toBe(PAGE_MAX)
    })

    it("round-trips a position", async () => {
        const subject = await buildSubject()
        expect(subject.positionOf(subject.cursorOf(position))).toEqual(position)
    })

    it("refuses what this module did not write", async () => {
        const subject = await buildSubject()
        const cursor = (text: string): string => Buffer.from(text, "utf8").toString("base64url")
        expect(subject.positionOf("garbage")).toBeNull()
        expect(subject.positionOf(cursor("2026-11-06T10:00:00Z|x"))).toBeNull()
        expect(subject.positionOf(cursor(`${position.at}|${position.id}|extra`))).toBeNull()
        expect(subject.positionOf(cursor(""))).toBeNull()
    })
})
