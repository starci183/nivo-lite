import assert from "node:assert/strict"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { messageOf, roomOf, seatOf } from "@tests/fixtures/builders/team-chat.builder"
import { TeamChatErrorCode } from "./errors/team-chat.error"
import { TEAM_CHAT_TAGS } from "./team-chat.decorators"
import type { TeamChatTags } from "./team-chat.port"
import { TeamChatRoomsService } from "./team-chat.service"
import { cursorOf } from "./team-chat.policy"
import type { ChatMemberRef, ChatRoomView, MessageView, SendInput, TeamChatResult } from "./team-chat.contracts"
import { TeamChatAccessService } from "./team-chat-access.service"
import { TeamChatApprovalsService } from "./team-chat-approvals.service"
import { TeamChatCardsService } from "./team-chat-cards.service"
import { TeamChatFilesService } from "./team-chat-files.service"
import { TeamChatStoreService } from "./team-chat-store.service"
import { TeamChatViewsService } from "./team-chat-views.service"

const WS = "11111111-1111-4111-8111-111111111111"
const ANA = "22222222-1111-4111-8111-111111111111"
const BEN = "23333333-1111-4111-8111-111111111111"
const BOT = "31111111-1111-4111-8111-111111111111"
const ROOM = "41111111-1111-4111-8111-111111111111"
const MSG = "51111111-1111-4111-8111-111111111111"
const MSG2 = "52222222-1111-4111-8111-111111111111"
const AT = "2026-11-06T10:00:00.123456Z"

const ana: ChatMemberRef = { memberKind: "user", memberId: ANA }
const ben: ChatMemberRef = { memberKind: "user", memberId: BEN }
const bot: ChatMemberRef = { memberKind: "agent", memberId: BOT }

const sendOf = (extra: Partial<SendInput> = {}): SendInput => ({
    roomId: ROOM,
    to: null,
    body: "hello",
    mentions: [],
    fileKeys: [],
    clientId: null,
    ...extra,
})

const valueOf = <V>(result: TeamChatResult<V>): V => {
    assert(result.ok, "expected a value, got a refusal")
    return result.value
}

const refusalOf = <V>(result: TeamChatResult<V>): string => (result.ok ? "done" : result.refusal)

const build = async (withTags = true) => {
    const store = mock<TeamChatStoreService>()
    const access = mock<TeamChatAccessService>()
    const views = mock<TeamChatViewsService>()
    const files = mock<TeamChatFilesService>()
    const cards = mock<TeamChatCardsService>()
    const approvals = mock<TeamChatApprovalsService>()
    const tags = mock<TeamChatTags>()
    access.visibleRoom.mockResolvedValue(roomOf())
    access.allKnown.mockResolvedValue(true)
    access.mayManage.mockResolvedValue(true)
    store.moveReadPosition.mockResolvedValue()
    const moduleRef = withTags
        ? await Test.createTestingModule({
              providers: [
                  TeamChatRoomsService,
                  { provide: TeamChatStoreService, useValue: store },
                  { provide: TeamChatAccessService, useValue: access },
                  { provide: TeamChatViewsService, useValue: views },
                  { provide: TeamChatFilesService, useValue: files },
                  { provide: TeamChatCardsService, useValue: cards },
                  { provide: TeamChatApprovalsService, useValue: approvals },
                  { provide: TEAM_CHAT_TAGS, useValue: tags },
              ],
          }).compile()
        : await Test.createTestingModule({
              providers: [
                  TeamChatRoomsService,
                  { provide: TeamChatStoreService, useValue: store },
                  { provide: TeamChatAccessService, useValue: access },
                  { provide: TeamChatViewsService, useValue: views },
                  { provide: TeamChatFilesService, useValue: files },
                  { provide: TeamChatCardsService, useValue: cards },
                  { provide: TeamChatApprovalsService, useValue: approvals },
              ],
          }).compile()
    return { subject: moduleRef.get(TeamChatRoomsService), store, access, views, files, cards, approvals, tags }
}

describe("TeamChatRoomsService rooms and room", () => {
    it("lists the rooms the store finds for the viewer, as an owner when the viewer owns the workspace", async () => {
        const { subject, store, access, views } = await build()
        access.isOwner.mockResolvedValue(true)
        store.rooms.mockResolvedValue([roomOf()])
        views.roomViews.mockResolvedValue([])
        expect(await subject.rooms(WS, ANA, "group", BEN)).toEqual([])
        expect(store.rooms).toHaveBeenCalledWith(WS, { viewerId: ANA, owner: true, kind: "group", member: BEN })
    })

    it("reads one room only when the viewer may see it", async () => {
        const { subject, access, views } = await build()
        const view = mock<ChatRoomView>()
        views.roomView.mockResolvedValue(view)
        expect(await subject.room(WS, ANA, ROOM)).toBe(view)
        access.visibleRoom.mockResolvedValue(null)
        expect(await subject.room(WS, ANA, ROOM)).toBeNull()
    })
})

describe("TeamChatRoomsService messages and unread", () => {
    it("answers an empty page for a room that is not visible and for a cursor it did not write", async () => {
        const { subject, access } = await build()
        const empty = { nodes: [], hasNextPage: false, endCursor: null }
        expect(await subject.messages(WS, ANA, ROOM, null, "bad", false)).toEqual(empty)
        access.visibleRoom.mockResolvedValue(null)
        expect(await subject.messages(WS, ANA, ROOM, null, null, false)).toEqual(empty)
    })

    it("pages the thread: the keys of one more than the size say there is a next page and name its cursor", async () => {
        const { subject, store, views } = await build()
        const first = { at: AT, id: MSG }
        store.threadKeys.mockResolvedValue([first, { at: AT, id: MSG2 }])
        store.messagesByIds.mockResolvedValue([messageOf({ id: MSG })])
        views.messageViews.mockResolvedValue([])
        const page = await subject.messages(WS, ANA, ROOM, 1, cursorOf({ at: AT, id: MSG2 }), true)
        expect(page).toEqual({ nodes: [], hasNextPage: true, endCursor: cursorOf(first) })
        expect(store.threadKeys).toHaveBeenCalledWith(WS, ROOM, { at: AT, id: MSG2 }, 1, true)
        expect(views.messageViews).toHaveBeenCalledWith(WS, [messageOf({ id: MSG })], ANA)
    })

    it("ends the page without a cursor when the keys fit in it", async () => {
        const { subject, store, views } = await build()
        store.threadKeys.mockResolvedValue([])
        store.messagesByIds.mockResolvedValue([])
        views.messageViews.mockResolvedValue([])
        expect(await subject.messages(WS, ANA, ROOM, null, null, false)).toEqual({
            nodes: [],
            hasNextPage: false,
            endCursor: null,
        })
    })

    it("sums the unread of the rooms and lists only the rooms with something unread", async () => {
        const { subject, store } = await build()
        const quiet = { roomId: MSG, unreadCount: 0, mentionCount: 0 }
        const busy = { roomId: ROOM, unreadCount: 3, mentionCount: 1 }
        store.unreadRows.mockResolvedValue([quiet, busy])
        expect(await subject.unread(WS, ANA)).toEqual({ total: 3, mentionTotal: 1, rooms: [busy] })
    })
})

describe("TeamChatRoomsService createRoom", () => {
    it("opens a group with its trimmed name and refuses one without a name or with an unknown member", async () => {
        const { subject, store, access, views } = await build()
        const view = mock<ChatRoomView>()
        store.insertRoom.mockResolvedValue(roomOf())
        views.roomView.mockResolvedValue(view)
        const group = { kind: "group" as const, name: "  Team ", members: [ana, ben] }
        expect(valueOf(await subject.createRoom(WS, ANA, group))).toBe(view)
        expect(store.insertRoom).toHaveBeenCalledWith({
            workspaceId: WS,
            createdBy: ANA,
            kind: "group",
            name: "Team",
            directKey: null,
            others: [ben],
        })
        expect(refusalOf(await subject.createRoom(WS, ANA, { ...group, name: " " }))).toBe(
            TeamChatErrorCode.GroupNeedsName,
        )
        access.allKnown.mockResolvedValue(false)
        expect(refusalOf(await subject.createRoom(WS, ANA, group))).toBe(TeamChatErrorCode.MemberUnknown)
    })

    it("opens a direct room once per pair and refuses a direct room that is not of exactly two", async () => {
        const { subject, store, access, views } = await build()
        const view = mock<ChatRoomView>()
        views.roomView.mockResolvedValue(view)
        store.insertRoom.mockResolvedValue(roomOf({ kind: "direct" }))
        const direct = { kind: "direct" as const, name: null, members: [ben] }
        store.roomByDirectKey.mockResolvedValue(null)
        expect(valueOf(await subject.createRoom(WS, ANA, direct))).toBe(view)
        expect(store.insertRoom).toHaveBeenCalledTimes(1)
        store.roomByDirectKey.mockResolvedValue(roomOf({ kind: "direct" }))
        expect(valueOf(await subject.createRoom(WS, ANA, direct))).toBe(view)
        expect(store.insertRoom).toHaveBeenCalledTimes(1)
        expect(refusalOf(await subject.createRoom(WS, ANA, { ...direct, members: [ben, bot] }))).toBe(
            TeamChatErrorCode.DirectNeedsTwo,
        )
        expect(refusalOf(await subject.createRoom(WS, ANA, { ...direct, members: [] }))).toBe(
            TeamChatErrorCode.DirectNeedsTwo,
        )
        expect(refusalOf(await subject.createRoom(WS, ANA, { ...direct, name: "Named" }))).toBe(
            TeamChatErrorCode.DirectNeedsTwo,
        )
        access.allKnown.mockResolvedValue(false)
        expect(refusalOf(await subject.createRoom(WS, ANA, direct))).toBe(TeamChatErrorCode.MemberUnknown)
    })
})

describe("TeamChatRoomsService addMember", () => {
    it("adds a member to a group and answers the room, with a refusal for each way it cannot", async () => {
        const { subject, store, access, views } = await build()
        const view = mock<ChatRoomView>()
        views.roomView.mockResolvedValue(view)
        store.memberOf.mockResolvedValue(null)
        expect(valueOf(await subject.addMember(WS, ANA, ROOM, ben))).toBe(view)
        expect(store.insertMember).toHaveBeenCalledWith(WS, ROOM, ben)
        store.memberOf.mockResolvedValue(seatOf("user", BEN))
        expect(refusalOf(await subject.addMember(WS, ANA, ROOM, ben))).toBe(TeamChatErrorCode.AlreadyMember)
        access.allKnown.mockResolvedValue(false)
        expect(refusalOf(await subject.addMember(WS, ANA, ROOM, ben))).toBe(TeamChatErrorCode.MemberUnknown)
        access.mayManage.mockResolvedValue(false)
        expect(refusalOf(await subject.addMember(WS, ANA, ROOM, ben))).toBe(TeamChatErrorCode.Forbidden)
        access.visibleRoom.mockResolvedValue(roomOf({ kind: "direct" }))
        expect(refusalOf(await subject.addMember(WS, ANA, ROOM, ben))).toBe(TeamChatErrorCode.Forbidden)
        access.visibleRoom.mockResolvedValue(null)
        expect(refusalOf(await subject.addMember(WS, ANA, ROOM, ben))).toBe(TeamChatErrorCode.NotFound)
    })
})

describe("TeamChatRoomsService removeMember", () => {
    it("removes a member and answers the room that is left", async () => {
        const { subject, store, views } = await build()
        const view = mock<ChatRoomView>()
        views.roomView.mockResolvedValue(view)
        store.membersOf.mockResolvedValue([seatOf("user", ANA, "owner"), seatOf("user", BEN)])
        expect(valueOf(await subject.removeMember(WS, ANA, ROOM, ben))).toBe(view)
        expect(store.deleteMember).toHaveBeenCalledWith(ROOM, ben)
    })

    it("lets a member leave, deletes the room with its last member, and keeps the last owner", async () => {
        const { subject, store, access } = await build()
        access.mayManage.mockResolvedValue(false)
        store.membersOf.mockResolvedValue([seatOf("user", BEN)])
        expect(valueOf(await subject.removeMember(WS, BEN, ROOM, ben))).toBeNull()
        expect(store.deleteRoom).toHaveBeenCalledWith(ROOM)
        store.membersOf.mockResolvedValue([seatOf("user", BEN, "owner"), seatOf("user", ANA)])
        expect(refusalOf(await subject.removeMember(WS, BEN, ROOM, ben))).toBe(TeamChatErrorCode.LastOwner)
    })

    it("refuses a stranger, a direct room, a member who is not there and a room that is not visible", async () => {
        const { subject, store, access } = await build()
        store.membersOf.mockResolvedValue([seatOf("user", ANA)])
        expect(refusalOf(await subject.removeMember(WS, ANA, ROOM, ben))).toBe(TeamChatErrorCode.NotAMemberToRemove)
        expect(refusalOf(await subject.removeMember(WS, ANA, ROOM, bot))).toBe(TeamChatErrorCode.NotAMemberToRemove)
        access.mayManage.mockResolvedValue(false)
        expect(refusalOf(await subject.removeMember(WS, ANA, ROOM, ben))).toBe(TeamChatErrorCode.Forbidden)
        access.visibleRoom.mockResolvedValue(roomOf({ kind: "direct" }))
        expect(refusalOf(await subject.removeMember(WS, ANA, ROOM, ana))).toBe(TeamChatErrorCode.Forbidden)
        access.visibleRoom.mockResolvedValue(null)
        expect(refusalOf(await subject.removeMember(WS, ANA, ROOM, ana))).toBe(TeamChatErrorCode.NotFound)
    })
})

describe("TeamChatRoomsService send", () => {
    it("stores a text, moves the viewer's read position to it and answers its view", async () => {
        const { subject, store, views, files } = await build()
        const view = mock<MessageView>()
        const stored = messageOf({ id: MSG })
        files.verify.mockResolvedValue({ ok: true, value: [] })
        store.sentBefore.mockResolvedValue(null)
        store.insertText.mockResolvedValue(stored)
        views.viewOf.mockResolvedValue(view)
        expect(valueOf(await subject.send(WS, ANA, sendOf({ clientId: "c1" })))).toBe(view)
        expect(store.insertText).toHaveBeenCalledWith({
            workspaceId: WS,
            roomId: ROOM,
            authorId: ANA,
            body: "hello",
            clientId: "c1",
            mentions: [],
            attachments: [],
        })
        expect(store.moveReadPosition).toHaveBeenCalledWith(WS, ROOM, ANA, MSG)
    })

    it("hands a mentioned agent the text once, and a retry stores and hands nothing again", async () => {
        const { subject, store, views, files, tags } = await build()
        files.verify.mockResolvedValue({ ok: true, value: [] })
        store.sentBefore.mockResolvedValue(null)
        store.insertText.mockResolvedValue(messageOf({ id: MSG, body: "hi bot" }))
        views.viewOf.mockResolvedValue(mock<MessageView>())
        valueOf(await subject.send(WS, ANA, sendOf({ body: "hi bot", mentions: [bot, ben] })))
        expect(tags.handOff).toHaveBeenCalledTimes(1)
        expect(tags.handOff).toHaveBeenCalledWith(WS, {
            userId: ANA,
            agentId: BOT,
            roomId: ROOM,
            messageId: MSG,
            text: "hi bot",
        })
        store.sentBefore.mockResolvedValue(messageOf({ id: MSG }))
        valueOf(await subject.send(WS, ANA, sendOf({ mentions: [bot], clientId: "c1" })))
        expect(store.insertText).toHaveBeenCalledTimes(1)
        expect(tags.handOff).toHaveBeenCalledTimes(1)
    })

    it("sends without a tag port when the app has none", async () => {
        const { subject, store, views, files } = await build(false)
        files.verify.mockResolvedValue({ ok: true, value: [] })
        store.sentBefore.mockResolvedValue(null)
        store.insertText.mockResolvedValue(messageOf())
        views.viewOf.mockResolvedValue(mock<MessageView>())
        expect(refusalOf(await subject.send(WS, ANA, sendOf({ mentions: [bot] })))).toBe("done")
    })
})

describe("TeamChatRoomsService send refusals", () => {
    it("refuses a bad text, an unknown mention, a file that does not verify and a room it cannot find", async () => {
        const { subject, access, files, store } = await build()
        store.sentBefore.mockResolvedValue(null)
        expect(refusalOf(await subject.send(WS, ANA, sendOf({ body: " " })))).toBe(TeamChatErrorCode.BodyEmpty)
        files.verify.mockResolvedValue({ ok: false, refusal: TeamChatErrorCode.FileTypeNotAllowed })
        expect(refusalOf(await subject.send(WS, ANA, sendOf({ fileKeys: ["k"] })))).toBe(
            TeamChatErrorCode.FileTypeNotAllowed,
        )
        access.allKnown.mockResolvedValue(false)
        expect(refusalOf(await subject.send(WS, ANA, sendOf({ mentions: [ben] })))).toBe(
            TeamChatErrorCode.MemberUnknown,
        )
        access.visibleRoom.mockResolvedValue(null)
        expect(refusalOf(await subject.send(WS, ANA, sendOf()))).toBe(TeamChatErrorCode.NotFound)
    })

    it("opens the direct room of a first message, and refuses one with no room and no one to send to", async () => {
        const { subject, store, views, files } = await build()
        files.verify.mockResolvedValue({ ok: true, value: [] })
        store.roomByDirectKey.mockResolvedValue(roomOf({ kind: "direct" }))
        views.roomView.mockResolvedValue(mock<ChatRoomView>())
        store.sentBefore.mockResolvedValue(null)
        store.insertText.mockResolvedValue(messageOf())
        views.viewOf.mockResolvedValue(mock<MessageView>())
        expect(refusalOf(await subject.send(WS, ANA, sendOf({ roomId: null, to: ben })))).toBe("done")
        expect(refusalOf(await subject.send(WS, ANA, sendOf({ roomId: null })))).toBe(TeamChatErrorCode.NotFound)
        expect(refusalOf(await subject.send(WS, ANA, sendOf({ roomId: null, to: ana })))).toBe(
            TeamChatErrorCode.NotFound,
        )
    })
})

describe("TeamChatRoomsService upload, mute, read and pins", () => {
    it("issues an upload address only to a viewer who sees the room", async () => {
        const { subject, access, files } = await build()
        files.requestUpload.mockResolvedValue({ ok: false, refusal: TeamChatErrorCode.FileTooLarge })
        const ask = { fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 1 }
        expect(refusalOf(await subject.requestUpload(WS, ANA, ROOM, ask))).toBe(TeamChatErrorCode.FileTooLarge)
        access.visibleRoom.mockResolvedValue(null)
        expect(refusalOf(await subject.requestUpload(WS, ANA, ROOM, ask))).toBe(TeamChatErrorCode.NotFound)
    })

    it("mutes a room for a member, and refuses a viewer without a seat or a room that is not visible", async () => {
        const { subject, store, access, views } = await build()
        const view = mock<ChatRoomView>()
        views.roomView.mockResolvedValue(view)
        store.setMuted.mockResolvedValue(true)
        expect(valueOf(await subject.setMuted(WS, ANA, ROOM, true))).toBe(view)
        store.setMuted.mockResolvedValue(false)
        expect(refusalOf(await subject.setMuted(WS, ANA, ROOM, true))).toBe(TeamChatErrorCode.NotMember)
        access.visibleRoom.mockResolvedValue(null)
        expect(refusalOf(await subject.setMuted(WS, ANA, ROOM, true))).toBe(TeamChatErrorCode.NotFound)
    })

    it("moves the read position to a named message or to now and answers what is still unread", async () => {
        const { subject, store } = await build()
        const unread = { roomId: ROOM, unreadCount: 2, mentionCount: 0 }
        store.memberOf.mockResolvedValue(seatOf("user", ANA))
        store.messageIn.mockResolvedValue(messageOf({ id: MSG }))
        store.unreadRows.mockResolvedValue([unread])
        expect(valueOf(await subject.markRead(WS, ANA, ROOM, MSG))).toEqual(unread)
        expect(store.moveReadPosition).toHaveBeenLastCalledWith(WS, ROOM, ANA, MSG)
        store.unreadRows.mockResolvedValue([])
        expect(valueOf(await subject.markRead(WS, ANA, ROOM, null))).toEqual({
            roomId: ROOM,
            unreadCount: 0,
            mentionCount: 0,
        })
        expect(store.moveReadPosition).toHaveBeenLastCalledWith(WS, ROOM, ANA, null)
    })

    it("refuses a read for a message that is not in the room, a viewer without a seat and a room that is not visible", async () => {
        const { subject, store, access } = await build()
        store.memberOf.mockResolvedValue(seatOf("user", ANA))
        store.messageIn.mockResolvedValue(null)
        expect(refusalOf(await subject.markRead(WS, ANA, ROOM, MSG))).toBe(TeamChatErrorCode.NotFound)
        store.memberOf.mockResolvedValue(null)
        expect(refusalOf(await subject.markRead(WS, ANA, ROOM, null))).toBe(TeamChatErrorCode.NotMember)
        access.visibleRoom.mockResolvedValue(null)
        expect(refusalOf(await subject.markRead(WS, ANA, ROOM, null))).toBe(TeamChatErrorCode.NotFound)
    })

    it("pins and unpins a message the viewer can reach, and refuses one it cannot", async () => {
        const { subject, store, access, views } = await build()
        const view = mock<MessageView>()
        access.pinnable.mockResolvedValue(messageOf({ id: MSG }))
        views.viewOf.mockResolvedValue(view)
        expect(valueOf(await subject.pin(WS, ANA, ROOM, MSG))).toBe(view)
        expect(store.insertPin).toHaveBeenCalledWith(WS, ROOM, MSG, ANA)
        expect(valueOf(await subject.unpin(WS, ANA, ROOM, MSG))).toBe(view)
        expect(store.deletePin).toHaveBeenCalledWith(ROOM, MSG)
        access.pinnable.mockResolvedValue(null)
        expect(refusalOf(await subject.pin(WS, ANA, ROOM, MSG))).toBe(TeamChatErrorCode.NotFound)
        expect(refusalOf(await subject.unpin(WS, ANA, ROOM, MSG))).toBe(TeamChatErrorCode.NotFound)
    })
})

describe("TeamChatRoomsService engine side", () => {
    it("hands the approval reads and the card writes to their classes", async () => {
        const { subject, cards, approvals } = await build()
        approvals.stateOf.mockResolvedValue(null)
        approvals.requestOf.mockResolvedValue(null)
        cards.postReport.mockResolvedValue(null)
        cards.postApproval.mockResolvedValue(4)
        cards.postMessage.mockResolvedValue(null)
        cards.postAsAgent.mockResolvedValue(null)
        expect(await subject.approvalOf(WS, ANA, MSG)).toBeNull()
        expect(await subject.approvalRequest(WS, MSG)).toBeNull()
        expect(await subject.postReport(WS, { runId: MSG, agentId: BOT, body: "done", roomId: null })).toBeNull()
        expect(
            await subject.postApproval(WS, {
                decisionId: MSG,
                agentId: BOT,
                body: "ok?",
                roomIds: [],
                approverSeatIds: [],
            }),
        ).toBe(4)
        expect(
            await subject.postMessage(WS, { key: "k", authorAgentId: BOT, body: "hi", roomId: ROOM, toUserId: null }),
        ).toBeNull()
        expect(await subject.postAsAgent(WS, { agent: "sales", body: "hi", toUserId: null, key: null })).toBeNull()
    })
})
