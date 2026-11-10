import assert from "node:assert/strict"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { messageOf, roomOf, seatOf } from "@tests/fixtures/builders/team-chat.builder"
import { TeamChatErrorCode } from "./errors/team-chat.error"
import type { MessageView, TeamChatResult } from "./team-chat.contracts"
import { TeamChatAccessService } from "./team-chat-access.service"
import { TeamChatForwardService } from "./team-chat-forward.service"
import { TeamChatStoreService } from "./team-chat-store.service"
import { TeamChatViewsService } from "./team-chat-views.service"

const WS = "11111111-1111-4111-8111-111111111111"
const ANA = "22222222-1111-4111-8111-111111111111"
const BOT = "31111111-1111-4111-8111-111111111111"
const FROM_ROOM = "41111111-1111-4111-8111-111111111111"
const TO_ROOM = "42222222-1111-4111-8111-111111111111"
const MSG = "51111111-1111-4111-8111-111111111111"
const NEW_MSG = "53333333-1111-4111-8111-111111111111"

const refusalOf = <V>(result: TeamChatResult<V>): string => (result.ok ? "done" : result.refusal)

const build = async (source = messageOf({ id: MSG, roomId: FROM_ROOM })) => {
    const store = mock<TeamChatStoreService>()
    const access = mock<TeamChatAccessService>()
    const views = mock<TeamChatViewsService>()
    store.messagesByIds.mockResolvedValue([source])
    store.memberOf.mockResolvedValue(seatOf("user", ANA))
    store.insertText.mockResolvedValue(messageOf({ id: NEW_MSG, roomId: TO_ROOM }))
    store.moveReadPosition.mockResolvedValue()
    access.visibleRoom.mockResolvedValue(roomOf())
    views.namesOf.mockResolvedValue(new Map([[`user:${source.authorId ?? ""}`, "Ben"]]))
    views.viewOf.mockResolvedValue(mock<MessageView>())
    const moduleRef = await Test.createTestingModule({
        providers: [
            TeamChatForwardService,
            { provide: TeamChatStoreService, useValue: store },
            { provide: TeamChatAccessService, useValue: access },
            { provide: TeamChatViewsService, useValue: views },
        ],
    }).compile()
    return { subject: moduleRef.get(TeamChatForwardService), store, access, views }
}

describe("TeamChatForwardService forward", () => {
    it("writes the text into the target room as a new message of the viewer, marked with whose words it is", async () => {
        const { subject, store } = await build(
            messageOf({ id: MSG, roomId: FROM_ROOM, body: "hello", authorId: "ben" }),
        )
        const result = await subject.forward(WS, ANA, MSG, TO_ROOM)
        expect(result.ok).toBe(true)
        expect(store.insertText).toHaveBeenCalledWith({
            workspaceId: WS,
            roomId: TO_ROOM,
            authorId: ANA,
            body: "hello",
            clientId: null,
            mentions: [],
            attachments: [],
            ref: { forwarded_from: "Ben" },
        })
        expect(store.moveReadPosition).toHaveBeenCalledWith(WS, TO_ROOM, ANA, NEW_MSG)
    })

    it("carries the card of an agent with its text", async () => {
        const card = messageOf({
            id: MSG,
            roomId: FROM_ROOM,
            authorKind: "agent",
            authorId: BOT,
            body: "Order total 10",
            ref: { agent_message: '{"kind":"order.summary"}' },
        })
        const { subject, store, views } = await build(card)
        views.namesOf.mockResolvedValue(new Map([[`agent:${BOT}`, "Sales"]]))
        await subject.forward(WS, ANA, MSG, TO_ROOM)
        expect(store.insertText).toHaveBeenCalledWith(
            expect.objectContaining({ ref: { forwarded_from: "Sales", agent_message: '{"kind":"order.summary"}' } }),
        )
    })

    it("keeps the first author when a forward is forwarded again", async () => {
        const again = messageOf({ id: MSG, roomId: FROM_ROOM, body: "hello", ref: { forwarded_from: "Cara" } })
        const { subject, store } = await build(again)
        await subject.forward(WS, ANA, MSG, TO_ROOM)
        expect(store.insertText).toHaveBeenCalledWith(expect.objectContaining({ ref: { forwarded_from: "Cara" } }))
    })

    it("refuses a viewer who does not see the room of the message, or the target room", async () => {
        const { subject, access, store } = await build()
        access.visibleRoom.mockResolvedValueOnce(null)
        expect(refusalOf(await subject.forward(WS, ANA, MSG, TO_ROOM))).toBe(TeamChatErrorCode.NotFound)
        access.visibleRoom.mockResolvedValueOnce(roomOf()).mockResolvedValueOnce(null)
        expect(refusalOf(await subject.forward(WS, ANA, MSG, TO_ROOM))).toBe(TeamChatErrorCode.NotFound)
        expect(store.insertText).not.toHaveBeenCalled()
    })

    it("refuses a viewer who does not sit in the target room", async () => {
        const { subject, store } = await build()
        store.memberOf.mockResolvedValue(null)
        expect(refusalOf(await subject.forward(WS, ANA, MSG, TO_ROOM))).toBe(TeamChatErrorCode.NotMember)
        expect(store.insertText).not.toHaveBeenCalled()
    })

    it("refuses a message that is absent, a line of the system and a message with no words", async () => {
        const absent = await build()
        absent.store.messagesByIds.mockResolvedValue([])
        expect(refusalOf(await absent.subject.forward(WS, ANA, MSG, TO_ROOM))).toBe(TeamChatErrorCode.NotFound)
        const system = await build(messageOf({ id: MSG, authorKind: "system", authorId: null, kind: "system" }))
        expect(refusalOf(await system.subject.forward(WS, ANA, MSG, TO_ROOM))).toBe(TeamChatErrorCode.NotFound)
        const silent = await build(messageOf({ id: MSG, body: "  ", attachments: [] }))
        const result = await silent.subject.forward(WS, ANA, MSG, TO_ROOM)
        assert(!result.ok, "expected a refusal")
        expect(result.refusal).toBe(TeamChatErrorCode.BodyEmpty)
    })
})
