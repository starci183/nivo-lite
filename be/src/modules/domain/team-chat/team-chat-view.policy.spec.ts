import { Test } from "@nestjs/testing"
import { messageOf, roomOf, seatOf } from "@tests/fixtures/builders/team-chat.builder"
import {
    compareRooms,
    decisionIdsOf,
    memberViewsOf,
    messageViewOf,
    nameKeyOf,
    refsOfMessages,
    roomViewOf,
} from "./team-chat-view.policy"
import type { MessageViewContext } from "./team-chat-view.policy"
import type { ChatRoomView } from "./team-chat.contracts"

const SUBJECT = Symbol("team-chat-view.policy")

const ANA = "22222222-1111-4111-8111-111111111111"
const BEN = "23333333-1111-4111-8111-111111111111"
const BOT = "31111111-1111-4111-8111-111111111111"
const ROOM = "41111111-1111-4111-8111-111111111111"
const MSG = "51111111-1111-4111-8111-111111111111"
const RUN = "61111111-1111-4111-8111-111111111111"
const DECISION = "71111111-1111-4111-8111-111111111111"
const AT = new Date("2026-11-06T10:00:00.000Z")
const LATER = new Date("2026-11-06T11:00:00.000Z")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    compareRooms,
                    decisionIdsOf,
                    memberViewsOf,
                    messageViewOf,
                    nameKeyOf,
                    refsOfMessages,
                    roomViewOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<{
        compareRooms: typeof compareRooms
        decisionIdsOf: typeof decisionIdsOf
        memberViewsOf: typeof memberViewsOf
        messageViewOf: typeof messageViewOf
        nameKeyOf: typeof nameKeyOf
        refsOfMessages: typeof refsOfMessages
        roomViewOf: typeof roomViewOf
    }>(SUBJECT)
}

const CONTEXT: MessageViewContext = {
    names: new Map([
        [`user:${ANA}`, "Ana"],
        [`user:${BEN}`, "Ben"],
        [`agent:${BOT}`, "Bot"],
    ]),
    pinned: new Set([MSG]),
    urls: new Map([["k1", "https://get/k1"]]),
    approvals: new Map([
        [DECISION, { decisionId: DECISION, status: "pending", decidedByName: null, decidedAt: null, canDecide: true }],
    ]),
}

describe("message views", () => {
    it("names the authors and the mentioned members, and skips a system line", async () => {
        const subject = await buildSubject()
        const refs = subject.refsOfMessages([
            messageOf({ mentions: [{ kind: "agent", id: BOT }] }),
            messageOf({ authorKind: "system", authorId: null }),
            messageOf({ authorKind: "system", authorId: ANA }),
        ])
        expect(refs).toEqual([
            { memberKind: "user", memberId: ANA },
            { memberKind: "agent", memberId: BOT },
        ])
        expect(subject.nameKeyOf("agent", BOT)).toBe(`agent:${BOT}`)
    })

    it("reads the decisions of the approval cards only", async () => {
        const subject = await buildSubject()
        expect(
            subject.decisionIdsOf([
                messageOf({ kind: "approval", ref: { decision_id: DECISION } }),
                messageOf({ kind: "approval", ref: null }),
                messageOf({ kind: "report", ref: { run_id: RUN } }),
                messageOf(),
            ]),
        ).toEqual([DECISION])
    })

    it("shows a text with its author, pin, mentions and files", async () => {
        const subject = await buildSubject()
        const view = subject.messageViewOf(
            messageOf({
                mentions: [{ kind: "agent", id: BOT }],
                attachments: [{ fileKey: "k1", name: "plan.pdf", mimeType: "application/pdf", sizeBytes: 9 }],
            }),
            CONTEXT,
        )
        expect(view).toEqual({
            id: MSG,
            roomId: ROOM,
            kind: "text",
            authorKind: "user",
            authorId: ANA,
            authorName: "Ana",
            body: "hello",
            createdAt: AT,
            editedAt: null,
            pinned: true,
            mentions: [{ memberKind: "agent", memberId: BOT, name: "Bot" }],
            attachments: [
                { fileKey: "k1", name: "plan.pdf", mimeType: "application/pdf", sizeBytes: 9, url: "https://get/k1" },
            ],
            runId: null,
            decisionId: null,
            approval: null,
        })
    })
})

describe("message views of cards and of unknown context", () => {
    it("shows a report with its run and an approval card with its decision and state", async () => {
        const subject = await buildSubject()
        expect(subject.messageViewOf(messageOf({ kind: "report", ref: { run_id: RUN } }), CONTEXT)).toMatchObject({
            runId: RUN,
            decisionId: null,
        })
        expect(
            subject.messageViewOf(messageOf({ kind: "approval", ref: { decision_id: DECISION } }), CONTEXT),
        ).toMatchObject({ runId: null, decisionId: DECISION, approval: { canDecide: true } })
        expect(subject.messageViewOf(messageOf({ kind: "report", ref: {} }), CONTEXT).runId).toBeNull()
    })

    it("shows empty names and addresses for what the context does not know, and no author for a system line", async () => {
        const subject = await buildSubject()
        const view = subject.messageViewOf(
            messageOf({
                id: "other",
                authorKind: "system",
                authorId: null,
                kind: "approval",
                ref: { decision_id: "unknown" },
                mentions: [{ kind: "user", id: "ghost" }],
                attachments: [{ fileKey: "k9", name: "x", mimeType: "text/plain", sizeBytes: 1 }],
            }),
            CONTEXT,
        )
        expect(view).toMatchObject({
            authorName: "",
            pinned: false,
            mentions: [{ name: "" }],
            attachments: [{ url: "" }],
            approval: null,
        })
        expect(subject.messageViewOf(messageOf({ authorId: "ghost" }), CONTEXT).authorName).toBe("")
    })
})

describe("room views", () => {
    const members = [seatOf("user", BEN, "member", true), seatOf("user", ANA, "owner"), seatOf("agent", BOT)]
    const context = {
        viewerId: ANA,
        names: CONTEXT.names,
        unread: new Map([[ROOM, { roomId: ROOM, unreadCount: 2, mentionCount: 1 }]]),
        lasts: new Map([[ROOM, messageViewOf(messageOf(), CONTEXT)]]),
    }

    it("lists owners first and then by name", async () => {
        const subject = await buildSubject()
        expect(subject.memberViewsOf(members, CONTEXT.names).map((view) => view.name)).toEqual(["Ana", "Ben", "Bot"])
        expect(subject.memberViewsOf([seatOf("user", "ghost")], CONTEXT.names)[0]?.name).toBe("")
    })

    it("shows a group with its name, counts, the mute of the viewer and the newest message", async () => {
        const subject = await buildSubject()
        const view = subject.roomViewOf(roomOf(), members, { ...context, viewerId: BEN })
        expect(view).toMatchObject({
            id: ROOM,
            kind: "group",
            name: "Team",
            position: 4,
            createdBy: ANA,
            unreadCount: 2,
            mentionCount: 1,
            muted: true,
            lastMessage: { id: MSG },
        })
        expect(view.members).toHaveLength(3)
    })

    it("names a direct room after the other member, and shows zeroes for a room nothing is known of", async () => {
        const subject = await buildSubject()
        const direct = subject.roomViewOf(roomOf({ kind: "direct", name: null }), members.slice(1), {
            ...context,
            unread: new Map(),
            lasts: new Map(),
        })
        expect(direct).toMatchObject({ name: "Bot", unreadCount: 0, mentionCount: 0, muted: false, lastMessage: null })
        expect(subject.roomViewOf(roomOf({ name: null }), [], context).name).toBe("")
        expect(subject.roomViewOf(roomOf({ kind: "direct", name: null }), [], context).name).toBe("")
    })

    it("sorts the room with the newest message first and the rooms with none by position", async () => {
        const subject = await buildSubject()
        const view = (position: number, at: Date | null): ChatRoomView => ({
            ...subject.roomViewOf(roomOf({ position }), [], context),
            lastMessage: at === null ? null : messageViewOf(messageOf({ createdAt: at }), CONTEXT),
        })
        const sorted = [view(2, null), view(9, AT), view(1, null), view(5, LATER)].toSorted(subject.compareRooms)
        expect(sorted.map((room) => room.position)).toEqual([5, 9, 1, 2])
    })
})
