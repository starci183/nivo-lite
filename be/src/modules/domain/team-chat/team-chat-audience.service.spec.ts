import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { IsNull } from "typeorm"
import { AgentDirectoryService } from "@modules/domain/agents"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { TeamChatErrorCode } from "./errors/team-chat.error"
import { ChatRoomEntity, ChatRoomMemberEntity, ChatRoomMessageEntity } from "./persistence/entities"
import type { ChatRoomView } from "./team-chat.contracts"
import type { TeamCardMessage } from "./team-chat-audience.contracts"
import { TeamChatAccessService } from "./team-chat-access.service"
import { TeamChatAudienceService } from "./team-chat-audience.service"
import { TeamChatCardsService } from "./team-chat-cards.service"
import { TeamChatStoreService } from "./team-chat-store.service"
import { TeamChatViewsService } from "./team-chat-views.service"

const WS = "11111111-1111-4111-8111-111111111111"
const ANA = "22222222-1111-4111-8111-111111111111"
const BOT = "31111111-1111-4111-8111-111111111111"
const ROOM = "41111111-1111-4111-8111-111111111111"
const DIRECT = "42222222-1111-4111-8111-111111111111"
const MSG = "51111111-1111-4111-8111-111111111111"
const GROUP_MSG = "52222222-1111-4111-8111-111111111111"
const SALES_BOT = { id: BOT, name: "Sales bot", module: "sales", canTagAgentIds: [] }
const SALES = { purpose: "module" as const, module: "sales" }
const MESSAGE: TeamCardMessage = { kind: "message.text", intent: "notify", title: "Hi", summary: "Hello", payload: {} }

const roomOf = (fields: Partial<ChatRoomEntity> = {}): ChatRoomEntity =>
    Object.assign(new ChatRoomEntity(), { id: ROOM, workspaceId: WS, kind: "group", name: "Sales", ...fields })
const DIRECT_ROOM = roomOf({ kind: "direct", name: null })
const seatOf = (mayPost: boolean): ChatRoomMemberEntity =>
    Object.assign(new ChatRoomMemberEntity(), { roomId: ROOM, memberKind: "agent", memberId: BOT, mayPost })

const build = async (em: MockEntityManager = mockEntityManager({ findOne: [ChatRoomEntity, roomOf()] })) => {
    const store = mock<TeamChatStoreService>()
    const access = mock<TeamChatAccessService>()
    const views = mock<TeamChatViewsService>()
    const cards = mock<TeamChatCardsService>()
    const agents = mock<AgentDirectoryService>()
    agents.find.mockResolvedValue(SALES_BOT)
    store.memberOf.mockResolvedValue(seatOf(true))
    access.visibleRoom.mockResolvedValue(roomOf())
    access.mayManage.mockResolvedValue(true)
    cards.postAsAgent.mockResolvedValue({ roomId: DIRECT, messageId: MSG, agentId: BOT })
    cards.postMessage.mockResolvedValue({ roomId: ROOM, messageId: GROUP_MSG })
    const moduleRef = await Test.createTestingModule({
        providers: [
            TeamChatAudienceService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: TeamChatStoreService, useValue: store },
            { provide: TeamChatAccessService, useValue: access },
            { provide: TeamChatViewsService, useValue: views },
            { provide: TeamChatCardsService, useValue: cards },
            { provide: AgentDirectoryService, useValue: agents },
        ],
    }).compile()
    return { subject: moduleRef.get(TeamChatAudienceService), em, store, access, views, cards, agents }
}

describe("TeamChatAudienceService rooms by purpose", () => {
    it("finds the common room and the room of one module, and says whether a purpose is held", async () => {
        const { subject, em } = await build()
        await expect(subject.roomByPurpose(WS, "module", "sales")).resolves.toMatchObject({ id: ROOM })
        await expect(subject.isHeld(WS, { purpose: "common" })).resolves.toBe(true)
        await expect(subject.isHeld(WS, { purpose: "group" })).resolves.toBe(false)
        expect(em.findOne).toHaveBeenNthCalledWith(1, ChatRoomEntity, {
            where: { workspaceId: WS, purpose: "module", purposeModule: "sales" },
        })
        expect(em.findOne).toHaveBeenNthCalledWith(2, ChatRoomEntity, {
            where: { workspaceId: WS, purpose: "common", purposeModule: IsNull() },
        })
        expect(em.findOne).toHaveBeenCalledTimes(2)
    })

    it("sets the purpose of a group from its settings and answers the room", async () => {
        const em = mockEntityManager({ update: [ChatRoomEntity, { affected: 1 }] })
        const { subject, store, views } = await build(em)
        const view = mock<ChatRoomView>()
        views.roomView.mockResolvedValue(view)
        store.roomOrFail.mockResolvedValue(roomOf())
        await expect(subject.setRoomPurpose(WS, ANA, ROOM, SALES)).resolves.toEqual({ ok: true, value: view })
        expect(em.update).toHaveBeenCalledWith(
            ChatRoomEntity,
            { id: ROOM },
            { purpose: "module", purposeModule: "sales" },
        )
    })

    it("refuses a purpose another room holds, an invalid one, a direct room, a viewer who may not manage and a missing room", async () => {
        const em = mockEntityManager({ update: [ChatRoomEntity, { affected: 1 }] })
        const { subject, access } = await build(em)
        const refusalOf = async (given = SALES) => {
            const result = await subject.setRoomPurpose(WS, ANA, ROOM, given)
            return result.ok ? null : result.refusal
        }
        em.update.mockRejectedValueOnce({ code: "23505" })
        await expect(refusalOf()).resolves.toBe(TeamChatErrorCode.PurposeTaken)
        await expect(refusalOf({ purpose: "module", module: " " })).resolves.toBe(TeamChatErrorCode.PurposeInvalid)
        access.mayManage.mockResolvedValueOnce(false)
        await expect(refusalOf()).resolves.toBe(TeamChatErrorCode.Forbidden)
        access.visibleRoom.mockResolvedValueOnce(DIRECT_ROOM)
        await expect(refusalOf()).resolves.toBe(TeamChatErrorCode.Forbidden)
        access.visibleRoom.mockResolvedValueOnce(null)
        await expect(refusalOf()).resolves.toBe(TeamChatErrorCode.NotFound)
        em.update.mockRejectedValueOnce({ code: "40001" })
        await expect(refusalOf()).rejects.toEqual({ code: "40001" })
    })
})

describe("TeamChatAudienceService audienceRoom", () => {
    it("finds the agent's own module room and the common room, and says whether the agent may post there", async () => {
        const { subject, store } = await build()
        store.memberOf.mockResolvedValueOnce(seatOf(false))
        await expect(subject.audienceRoom(WS, BOT, "own")).resolves.toEqual({
            found: true,
            room: { id: ROOM, name: "Sales", purpose: "module", module: "sales", mayPost: false },
        })
        expect(store.memberOf).toHaveBeenCalledWith(ROOM, { memberKind: "agent", memberId: BOT })
        await expect(subject.audienceRoom(WS, BOT, "everyone")).resolves.toMatchObject({
            room: { purpose: "common", module: null, mayPost: true },
        })
        store.memberOf.mockResolvedValueOnce(null)
        await expect(subject.audienceRoom(WS, BOT, "own")).resolves.toMatchObject({ room: { mayPost: false } })
    })

    it("says why there is none: the agent is not of the workspace, or no room holds the purpose", async () => {
        const { subject, agents } = await build(mockEntityManager({ findOne: [ChatRoomEntity, null] }))
        await expect(subject.audienceRoom(WS, BOT, "own")).resolves.toEqual({
            found: false,
            reason: "room_missing",
            module: "sales",
        })
        agents.find.mockResolvedValueOnce(null)
        await expect(subject.audienceRoom(WS, BOT, "own")).resolves.toEqual({
            found: false,
            reason: "agent_unknown",
            module: null,
        })
    })
})

describe("TeamChatAudienceService setPostRight", () => {
    it("grants and revokes an agent's right on its seat and answers the room", async () => {
        const em = mockEntityManager({ update: [ChatRoomMemberEntity, { affected: 1 }] })
        const { subject, views } = await build(em)
        const view = mock<ChatRoomView>()
        views.roomView.mockResolvedValue(view)
        await expect(subject.setPostRight(WS, ANA, ROOM, BOT, true)).resolves.toEqual({ ok: true, value: view })
        await subject.setPostRight(WS, ANA, ROOM, BOT, false)
        const where = { roomId: ROOM, memberKind: "agent", memberId: BOT }
        expect(em.update).toHaveBeenNthCalledWith(1, ChatRoomMemberEntity, where, { mayPost: true })
        expect(em.update).toHaveBeenNthCalledWith(2, ChatRoomMemberEntity, where, { mayPost: false })
    })

    it("refuses an agent with no seat, a direct room, a viewer who may not manage and a missing room", async () => {
        const em = mockEntityManager({ update: [ChatRoomMemberEntity, { affected: 1 }] })
        const { subject, store, access } = await build(em)
        const refusalOf = async () => {
            const result = await subject.setPostRight(WS, ANA, ROOM, BOT, true)
            return result.ok ? null : result.refusal
        }
        store.memberOf.mockResolvedValueOnce(null)
        await expect(refusalOf()).resolves.toBe(TeamChatErrorCode.PostRightNeedsSeat)
        access.mayManage.mockResolvedValueOnce(false)
        await expect(refusalOf()).resolves.toBe(TeamChatErrorCode.Forbidden)
        access.visibleRoom.mockResolvedValueOnce(DIRECT_ROOM)
        await expect(refusalOf()).resolves.toBe(TeamChatErrorCode.Forbidden)
        access.visibleRoom.mockResolvedValueOnce(null)
        await expect(refusalOf()).resolves.toBe(TeamChatErrorCode.NotFound)
        expect(em.update).not.toHaveBeenCalled()
    })
})

describe("TeamChatAudienceService postTeamCard", () => {
    const post = { agentId: BOT, audience: "own" as const, message: MESSAGE, key: "agent-message:k1" }
    const line = { body: "Hello", agentMessage: JSON.stringify(MESSAGE) }
    const direct = { purpose: "direct", roomId: DIRECT, roomName: null }

    it("posts in the founder's direct room and in the agent's team room when it holds the right there", async () => {
        const { subject, cards } = await build()
        await expect(subject.postTeamCard(WS, post)).resolves.toEqual({
            messageId: MSG,
            facts: {
                requested: "own",
                rooms: [direct, { purpose: "module", roomId: ROOM, roomName: "Sales" }],
                skipped: null,
                module: "sales",
            },
        })
        expect(cards.postAsAgent).toHaveBeenCalledWith(WS, {
            agent: BOT,
            toUserId: null,
            key: "agent-message:k1",
            ...line,
        })
        expect(cards.postMessage).toHaveBeenCalledWith(WS, {
            authorAgentId: BOT,
            roomId: ROOM,
            toUserId: null,
            key: "agent-message:k1#module",
            ...line,
        })
    })

    it("posts in the common room too for everyone, and only in the direct room for the founder", async () => {
        const { subject, cards, em } = await build()
        await expect(subject.postTeamCard(WS, { ...post, audience: "everyone" })).resolves.toMatchObject({
            facts: { requested: "everyone", rooms: [direct, { purpose: "common", roomId: ROOM }], skipped: null },
        })
        await expect(subject.postTeamCard(WS, { ...post, audience: "founder" })).resolves.toEqual({
            messageId: MSG,
            facts: { requested: "founder", rooms: [direct], skipped: null, module: null },
        })
        expect(cards.postMessage).toHaveBeenCalledTimes(1)
        expect(em.findOne).toHaveBeenCalledTimes(1)
    })
})

describe("TeamChatAudienceService postTeamCard without a group", () => {
    const post = { agentId: BOT, audience: "own" as const, message: MESSAGE, key: "agent-message:k1" }
    const direct = { purpose: "direct", roomId: DIRECT, roomName: null }

    it("posts only in the direct room when the agent holds no right in the room, a seat alone included", async () => {
        const { subject, store, cards } = await build()
        store.memberOf.mockResolvedValueOnce(seatOf(false)).mockResolvedValueOnce(null)
        for (const audience of ["own", "everyone"] as const) {
            await expect(subject.postTeamCard(WS, { ...post, audience })).resolves.toMatchObject({
                messageId: MSG,
                facts: { rooms: [direct], skipped: "no_post_right" },
            })
        }
        expect(cards.postMessage).not.toHaveBeenCalled()
        expect(store.insertMember).not.toHaveBeenCalled()
    })

    it("posts only in the direct room when the workspace has no team room or no common room, and says which", async () => {
        const { subject, cards } = await build(mockEntityManager({ findOne: [ChatRoomEntity, null] }))
        await expect(subject.postTeamCard(WS, post)).resolves.toMatchObject({
            facts: { rooms: [direct], skipped: "no_team_room" },
        })
        await expect(subject.postTeamCard(WS, { ...post, audience: "everyone" })).resolves.toMatchObject({
            facts: { rooms: [direct], skipped: "no_common_room" },
        })
        expect(cards.postMessage).not.toHaveBeenCalled()
    })

    it("fails when the agent is not of the workspace, or a line went nowhere", async () => {
        const { subject, agents, cards } = await build()
        agents.find.mockResolvedValueOnce(null)
        await expect(subject.postTeamCard(WS, post)).rejects.toMatchObject({
            code: TeamChatErrorCode.AgentMessageNotPosted,
        })
        cards.postMessage.mockResolvedValueOnce(null)
        await expect(subject.postTeamCard(WS, post)).rejects.toMatchObject({
            code: TeamChatErrorCode.AgentMessageNotPosted,
        })
        cards.postAsAgent.mockResolvedValueOnce(null)
        await expect(subject.postTeamCard(WS, { ...post, audience: "founder" })).rejects.toMatchObject({
            code: TeamChatErrorCode.AgentMessageNotPosted,
        })
    })
})

describe("TeamChatAudienceService folding a card", () => {
    const KEY = "agent-message:run-stuck:run-1:settle"
    const folded: TeamCardMessage = { ...MESSAGE, summary: "again", payload: { repeats: 2 }, occurrence: "k2" }

    it("reads the stored content of the founder's line by its key, and nothing for a missing or unreadable one", async () => {
        const { subject, store } = await build()
        store.agentLine.mockResolvedValueOnce(
            Object.assign(new ChatRoomMessageEntity(), { id: MSG, ref: { agent_message: JSON.stringify(MESSAGE) } }),
        )
        await expect(subject.storedCard(WS, KEY)).resolves.toEqual(MESSAGE)
        store.agentLine.mockResolvedValueOnce(null)
        await expect(subject.storedCard(WS, KEY)).resolves.toBeNull()
        store.agentLine.mockResolvedValueOnce(Object.assign(new ChatRoomMessageEntity(), { id: MSG, ref: { agent_message: "{" } }))
        await expect(subject.storedCard(WS, KEY)).resolves.toBeNull()
    })

    it("rewrites the line in every room it went to under its own client ids, so a reply to the folded card still names the same key", async () => {
        const { subject, store } = await build()
        store.agentLine.mockResolvedValue(Object.assign(new ChatRoomMessageEntity(), { id: MSG, clientId: KEY }))

        await expect(subject.foldTeamCard(WS, KEY, folded)).resolves.toBe(MSG)

        const [workspace, clientIds, content] = store.updateAgentLines.mock.calls[0] ?? []
        expect(workspace).toBe(WS)
        expect(clientIds).toEqual([KEY, `${KEY}#module`, `${KEY}#common`])
        expect(content).toEqual({ body: "again", agentMessage: JSON.stringify(folded) })
        expect(store.insertLine).not.toHaveBeenCalled()
    })

    it("folds nothing when the line is not there", async () => {
        const { subject, store } = await build()
        store.agentLine.mockResolvedValue(null)
        await expect(subject.foldTeamCard(WS, KEY, folded)).resolves.toBeNull()
        expect(store.updateAgentLines).not.toHaveBeenCalled()
    })
})
