import assert from "node:assert/strict"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { messageOf, roomOf } from "@tests/fixtures/builders/team-chat.builder"
import { TEAM_CHAT_TAGS } from "./team-chat.decorators"
import type { TeamChatTags } from "./team-chat.port"
import { TeamChatRoomsService } from "./team-chat.service"
import { lineKeyOf } from "./team-chat.policy"
import type { MessageView, SendInput, TeamChatResult } from "./team-chat.contracts"
import { TeamChatAccessService } from "./team-chat-access.service"
import { TeamChatCardsService } from "./team-chat-cards.service"
import { TeamChatFilesService } from "./team-chat-files.service"
import { TeamChatStoreService } from "./team-chat-store.service"
import { TeamChatViewsService } from "./team-chat-views.service"


const WS = "11111111-1111-4111-8111-111111111111"
const ANA = "22222222-1111-4111-8111-111111111111"
const BOT = "31111111-1111-4111-8111-111111111111"
const ROOM = "41111111-1111-4111-8111-111111111111"
const MSG = "51111111-1111-4111-8111-111111111111"
const MSG2 = "52222222-1111-4111-8111-111111111111"

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

const build = async (withTags = true) => {
    const store = mock<TeamChatStoreService>()
    const access = mock<TeamChatAccessService>()
    const views = mock<TeamChatViewsService>()
    const files = mock<TeamChatFilesService>()
    const cards = mock<TeamChatCardsService>()
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
              ],
          }).compile()
    return { subject: moduleRef.get(TeamChatRoomsService), store, access, views, files, cards, tags }
}

describe("TeamChatRoomsService engine side", () => {
    it("hands the card writes to their class", async () => {
        const { subject, cards } = await build()
        cards.postReport.mockResolvedValue(null)
        cards.postMessage.mockResolvedValue(null)
        cards.postAsAgent.mockResolvedValue(null)
        expect(await subject.postReport(WS, { runId: MSG, agentId: BOT, body: "done", roomId: null })).toBeNull()
        expect(
            await subject.postMessage(WS, { key: "k", authorAgentId: BOT, body: "hi", roomId: ROOM, toUserId: null }),
        ).toBeNull()
        expect(await subject.postAsAgent(WS, { agent: "sales", body: "hi", toUserId: null, key: null })).toBeNull()
        expect(cards.postReport).toHaveBeenCalledTimes(1)
    })
})

/** A world in which the room holds the agent's line `MSG2`, written under `clientId`, and the next text is stored as `MSG`. */
const buildReplying = async (clientId: string | null, authorKind: "agent" | "user" = "agent") => {
    const world = await build()
    world.files.verify.mockResolvedValue({ ok: true, value: [] })
    world.store.sentBefore.mockResolvedValue(null)
    world.store.messageIn.mockResolvedValue(messageOf({ id: MSG2, authorKind, authorId: BOT, clientId }))
    world.store.insertText.mockResolvedValue(messageOf({ id: MSG, replyTo: MSG2 }))
    world.views.viewOf.mockResolvedValue(mock<MessageView>())
    return world
}

describe("TeamChatRoomsService replies to a line an agent wrote under a key", () => {
    it("tells the listener who replied to which line, once the reply is stored, and nothing on a retry of the same reply", async () => {
        const { subject, store } = await buildReplying("line-key-1")
        const heard = jest.fn().mockResolvedValue(undefined)
        subject.listenReplies(heard)

        valueOf(await subject.send(WS, ANA, sendOf({ replyTo: MSG2, body: "cho qua" })))

        expect(heard).toHaveBeenCalledTimes(1)
        // The reply itself travels with it: its id, the words stored and the database time, so two replies at once never mix.
        const stored = messageOf({ id: MSG, replyTo: MSG2 })
        expect(heard).toHaveBeenCalledWith({
            workspaceId: WS,
            byUserId: ANA,
            lineKey: "line-key-1",
            messageId: MSG,
            text: stored.body,
            at: stored.createdAt.toISOString(),
        })
        store.sentBefore.mockResolvedValue(messageOf({ id: MSG }))
        valueOf(await subject.send(WS, ANA, sendOf({ replyTo: MSG2, body: "cho qua", clientId: "c1" })))
        expect(heard).toHaveBeenCalledTimes(1)
    })

    it("tells nobody of a reply to a person's message, to an agent's line written under no key, or of a text that replies to nothing", async () => {
        const person = await buildReplying("line-key-1", "user")
        const keyless = await buildReplying(null)
        const heard = jest.fn().mockResolvedValue(undefined)
        person.subject.listenReplies(heard)
        keyless.subject.listenReplies(heard)

        valueOf(await person.subject.send(WS, ANA, sendOf({ replyTo: MSG2 })))
        valueOf(await keyless.subject.send(WS, ANA, sendOf({ replyTo: MSG2 })))
        valueOf(await keyless.subject.send(WS, ANA, sendOf()))

        expect(heard).not.toHaveBeenCalled()
    })

    it("still stores the person's reply when the listener fails or nobody listens: the chat does no business itself", async () => {
        const failing = await buildReplying("line-key-1")
        failing.subject.listenReplies(jest.fn().mockRejectedValue(new Error("retry refused")))
        const silent = await buildReplying("line-key-1")

        expect((await failing.subject.send(WS, ANA, sendOf({ replyTo: MSG2 }))).ok).toBe(true)
        expect((await silent.subject.send(WS, ANA, sendOf({ replyTo: MSG2 }))).ok).toBe(true)
        expect(failing.store.moveReadPosition).toHaveBeenCalledWith(WS, ROOM, ANA, MSG)
    })

})

describe("TeamChatRoomsService reads the replies to a keyed line", () => {
    const KEY = "run-stuck:run-1:mark-paid"

    it("reads what people replied to the line of a key, oldest first as the store answers them, and nothing when no line holds the key", async () => {
        const { subject, store } = await build()
        store.agentLine.mockResolvedValueOnce(messageOf({ id: MSG2, authorKind: "agent", authorId: BOT }))
        store.repliesTo.mockResolvedValue([
            messageOf({ id: MSG, body: "Khach chuyen thieu 2k", createdAt: new Date("2026-11-10T03:00:00.000Z") }),
            messageOf({ id: MSG, body: "Cho qua", createdAt: new Date("2026-11-10T03:01:00.000Z") }),
        ])

        await expect(subject.repliesToAgentLine(WS, KEY)).resolves.toEqual([
            { text: "Khach chuyen thieu 2k", at: "2026-11-10T03:00:00.000Z" },
            { text: "Cho qua", at: "2026-11-10T03:01:00.000Z" },
        ])
        // The line is looked up under the stored form of the key it was posted with.
        expect(store.agentLine).toHaveBeenCalledWith(WS, lineKeyOf(KEY))
        expect(store.repliesTo).toHaveBeenCalledWith(WS, MSG2)

        store.agentLine.mockResolvedValueOnce(null)
        await expect(subject.repliesToAgentLine(WS, "run-stuck:none:none")).resolves.toEqual([])
        expect(store.repliesTo).toHaveBeenCalledTimes(1)
    })
})
