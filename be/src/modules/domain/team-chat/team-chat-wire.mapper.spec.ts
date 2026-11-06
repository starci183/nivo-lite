import { Test } from "@nestjs/testing"
import { TeamChatErrorCode } from "./errors/team-chat.error"
import {
    roomPayloadOf,
    messagePayloadOf,
    uploadPayloadOf,
    readPayloadOf,
    decisionPayloadOf,
    messageWireOf,
    roomWireOf,
    roomsWireOf,
    roomOrNullWireOf,
    messagePageWireOf,
    memberRefOf,
    roomsRequestOf,
    messagesRequestOf,
    createRoomRequestOf,
    roomMemberRequestOf,
    decideRequestOf,
    sendRequestOf,
} from "./team-chat-wire.mapper"
import type * as Mapper from "./team-chat-wire.mapper"
import type { ApprovalState, MessageView, ChatRoomView } from "./team-chat.contracts"

const SUBJECT = Symbol("team-chat-wire.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    roomPayloadOf,
                    messagePayloadOf,
                    uploadPayloadOf,
                    readPayloadOf,
                    decisionPayloadOf,
                    messageWireOf,
                    roomWireOf,
                    roomsWireOf,
                    roomOrNullWireOf,
                    messagePageWireOf,
                    memberRefOf,
                    roomsRequestOf,
                    messagesRequestOf,
                    createRoomRequestOf,
                    roomMemberRequestOf,
                    decideRequestOf,
                    sendRequestOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof Mapper>(SUBJECT)
}

const ID_A = "11111111-1111-4111-8111-111111111111"
const ID_B = "22222222-2222-4222-8222-222222222222"
const ID_C = "33333333-3333-4333-8333-333333333333"
const AT = new Date("2026-01-02T03:04:05.000Z")
const ISO = "2026-01-02T03:04:05.000Z"

const APPROVAL: ApprovalState = {
    decisionId: ID_C,
    status: "approved",
    decidedByName: "Lan",
    decidedAt: AT,
    canDecide: false,
}

const MESSAGE: MessageView = {
    id: ID_A,
    roomId: ID_B,
    kind: "text",
    authorKind: "user",
    authorId: ID_C,
    authorName: "Lan",
    body: "hello",
    createdAt: AT,
    editedAt: null,
    pinned: false,
    mentions: [{ memberKind: "agent", memberId: ID_A, name: "Bot" }],
    attachments: [{ fileKey: "k", name: "a.pdf", mimeType: "application/pdf", sizeBytes: 3, url: "https://u" }],
    runId: null,
    decisionId: null,
    approval: null,
}

const ROOM: ChatRoomView = {
    id: ID_B,
    kind: "group",
    name: "Ops",
    position: 1,
    createdBy: ID_C,
    createdAt: AT,
    members: [{ memberKind: "user", memberId: ID_C, name: "Lan", role: "owner", lastReadAt: AT, muted: false }],
    unreadCount: 2,
    mentionCount: 1,
    muted: false,
    lastMessage: null,
}

describe("refusals and payloads", () => {
    it("names every refusal code in snake case and answers a value with a null refusal", async () => {
        const subject = await buildSubject()
        const names = Object.values(TeamChatErrorCode).map(
            (code) => subject.roomPayloadOf({ ok: false, refusal: code }).refusal,
        )
        expect(names).toHaveLength(16)
        expect(names).toContain("not_a_member_to_remove")
        expect(subject.roomPayloadOf({ ok: false, refusal: TeamChatErrorCode.NotFound })).toEqual({
            room: null,
            refusal: "not_found",
        })
        expect(subject.roomPayloadOf({ ok: true, value: null })).toEqual({ room: null, refusal: null })
        expect(subject.roomPayloadOf({ ok: true, value: ROOM })).toEqual({
            room: subject.roomWireOf(ROOM),
            refusal: null,
        })
    })

    it("builds the message, upload, read and decision payloads", async () => {
        const subject = await buildSubject()
        expect(subject.messagePayloadOf({ ok: true, value: MESSAGE })).toEqual({
            message: subject.messageWireOf(MESSAGE),
            refusal: null,
        })
        expect(subject.messagePayloadOf({ ok: false, refusal: TeamChatErrorCode.Forbidden })).toEqual({
            message: null,
            refusal: "forbidden",
        })
        const upload = { fileKey: "k", uploadUrl: "https://put", method: "PUT", headers: [], expiresAt: AT } as const
        expect(subject.uploadPayloadOf({ ok: true, value: upload })).toEqual({
            upload: { ...upload, expiresAt: ISO },
            refusal: null,
        })
        expect(subject.uploadPayloadOf({ ok: false, refusal: TeamChatErrorCode.FileTooLarge })).toEqual({
            upload: null,
            refusal: "file_too_large",
        })
        const unread = { roomId: ID_B, unreadCount: 0, mentionCount: 0 }
        expect(subject.readPayloadOf({ ok: true, value: unread })).toEqual({ unread, refusal: null })
        expect(subject.readPayloadOf({ ok: false, refusal: TeamChatErrorCode.NotMember })).toEqual({
            unread: null,
            refusal: "not_member",
        })
        expect(subject.decisionPayloadOf({ ok: true, approval: APPROVAL })).toEqual({
            approval: { ...APPROVAL, decidedAt: ISO },
            refusal: null,
        })
        expect(subject.decisionPayloadOf({ ok: false, refusal: "decision_closed" })).toEqual({
            approval: null,
            refusal: "decision_closed",
        })
    })
})

describe("wire shapes", () => {
    it("turns instants into ISO text and a report or approval into its wire form", async () => {
        const subject = await buildSubject()
        expect(subject.messageWireOf(MESSAGE)).toMatchObject({
            createdAt: ISO,
            editedAt: null,
            report: null,
            approval: null,
        })
        expect(
            subject.messageWireOf({ ...MESSAGE, editedAt: AT, runId: ID_A, authorId: ID_C, approval: APPROVAL }),
        ).toMatchObject({
            editedAt: ISO,
            report: { runId: ID_A, agentId: ID_C },
            approval: { ...APPROVAL, decidedAt: ISO },
        })
        expect(subject.messageWireOf({ ...MESSAGE, runId: ID_A, authorId: null }).report).toBeNull()
        expect(
            subject.messageWireOf({ ...MESSAGE, approval: { ...APPROVAL, decidedAt: null, status: "pending" } })
                .approval,
        ).toMatchObject({ decidedAt: null })
    })

    it("shows a room with its members and last message, a list, a page and an absent room", async () => {
        const subject = await buildSubject()
        expect(subject.roomWireOf(ROOM)).toMatchObject({
            createdAt: ISO,
            members: [{ memberId: ID_C, lastReadAt: ISO }],
            lastMessage: null,
        })
        expect(subject.roomWireOf({ ...ROOM, lastMessage: MESSAGE }).lastMessage).toMatchObject({
            id: ID_A,
            createdAt: ISO,
        })
        expect(subject.roomsWireOf([ROOM, ROOM])).toHaveLength(2)
        expect(subject.roomOrNullWireOf(null)).toBeNull()
        expect(subject.roomOrNullWireOf(ROOM)).toEqual(subject.roomWireOf(ROOM))
        expect(subject.messagePageWireOf({ nodes: [MESSAGE], hasNextPage: true, endCursor: "c" })).toEqual({
            nodes: [subject.messageWireOf(MESSAGE)],
            pageInfo: { hasNextPage: true, endCursor: "c" },
        })
    })
})

describe("request builders", () => {
    it("reads a member reference, keeping an agent and treating any other kind as a user", async () => {
        const subject = await buildSubject()
        expect(subject.memberRefOf({ memberKind: "agent", memberId: ID_A })).toEqual({
            memberKind: "agent",
            memberId: ID_A,
        })
        expect(subject.memberRefOf({ memberKind: "user", memberId: ID_A })).toEqual({
            memberKind: "user",
            memberId: ID_A,
        })
        expect(subject.memberRefOf({ memberKind: "other", memberId: ID_A }).memberKind).toBe("user")
    })

    it("builds the list request with a known kind or none, and an absent input", async () => {
        const subject = await buildSubject()
        expect(subject.roomsRequestOf(ID_A, { kind: "direct", member: ID_B })).toEqual({
            workspaceId: ID_A,
            kind: "direct",
            member: ID_B,
        })
        expect(subject.roomsRequestOf(ID_A, { kind: "group", member: null }).kind).toBe("group")
        expect(subject.roomsRequestOf(ID_A, { kind: "weird", member: null }).kind).toBeNull()
        expect(subject.roomsRequestOf(ID_A, { kind: null, member: null }).kind).toBeNull()
        expect(subject.roomsRequestOf(ID_A, undefined)).toEqual({ workspaceId: ID_A, kind: null, member: null })
    })
})

describe("request builders of a thread, a room and a message", () => {
    it("builds the thread, room, member and decision requests", async () => {
        const subject = await buildSubject()
        expect(subject.messagesRequestOf(ID_A, { roomId: ID_B, first: 10, after: "c", pinnedOnly: true })).toEqual({
            workspaceId: ID_A,
            roomId: ID_B,
            first: 10,
            after: "c",
            pinnedOnly: true,
        })
        expect(
            subject.messagesRequestOf(ID_A, { roomId: ID_B, first: null, after: null, pinnedOnly: null }).pinnedOnly,
        ).toBe(false)
        const members = [{ memberKind: "agent", memberId: ID_C }]
        expect(subject.createRoomRequestOf(ID_A, { kind: "direct", name: null, members })).toEqual({
            workspaceId: ID_A,
            kind: "direct",
            name: null,
            members: [{ memberKind: "agent", memberId: ID_C }],
        })
        expect(subject.createRoomRequestOf(ID_A, { kind: "group", name: "Ops", members }).kind).toBe("group")
        expect(
            subject.roomMemberRequestOf(ID_A, { roomId: ID_B, member: members[0] ?? { memberKind: "", memberId: "" } }),
        ).toEqual({
            workspaceId: ID_A,
            roomId: ID_B,
            member: { memberKind: "agent", memberId: ID_C },
        })
        expect(subject.decideRequestOf(ID_A, { decisionId: ID_B, verdict: "reject" }).verdict).toBe("reject")
        expect(subject.decideRequestOf(ID_A, { decisionId: ID_B, verdict: "approve" }).verdict).toBe("approve")
    })

    it("builds the send request with defaults for what is absent", async () => {
        const subject = await buildSubject()
        expect(
            subject.sendRequestOf(ID_A, {
                roomId: ID_B,
                to: { memberKind: "agent", memberId: ID_C },
                body: "hi",
                mentions: [{ memberKind: "user", memberId: ID_A }],
                fileKeys: ["k"],
                clientId: "c",
            }),
        ).toEqual({
            workspaceId: ID_A,
            roomId: ID_B,
            to: { memberKind: "agent", memberId: ID_C },
            body: "hi",
            mentions: [{ memberKind: "user", memberId: ID_A }],
            fileKeys: ["k"],
            clientId: "c",
        })
        expect(
            subject.sendRequestOf(ID_A, {
                roomId: null,
                to: null,
                body: "",
                mentions: null,
                fileKeys: null,
                clientId: null,
            }),
        ).toEqual({ workspaceId: ID_A, roomId: null, to: null, body: "", mentions: [], fileKeys: [], clientId: null })
    })
})
