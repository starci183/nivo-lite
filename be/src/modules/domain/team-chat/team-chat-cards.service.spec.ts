import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import { WorkspacesService } from "@modules/domain/workspaces"
import { ChatRoomEntity } from "./persistence/entities"
import { TeamChatAccessService } from "./team-chat-access.service"
import { TeamChatCardsService } from "./team-chat-cards.service"
import { TeamChatStoreService } from "./team-chat-store.service"
import { directKeyOf } from "./team-chat.policy"

const WS = "11111111-1111-4111-8111-111111111111"
const OWNER = "21111111-1111-4111-8111-111111111111"
const ANA = "22222222-1111-4111-8111-111111111111"
const BOT = "31111111-1111-4111-8111-111111111111"
const NAMED = "41111111-1111-4111-8111-111111111111"
const DIRECT = "42222222-1111-4111-8111-111111111111"
const OPENED = "43333333-1111-4111-8111-111111111111"
const MSG = "51111111-1111-4111-8111-111111111111"
const RUN = "61111111-1111-4111-8111-111111111111"

const roomOf = (id: string) => Object.assign(new ChatRoomEntity(), { id })

const build = async () => {
    const store = mock<TeamChatStoreService>()
    const access = mock<TeamChatAccessService>()
    const seats = mock<WorkspaceMemberSeatsService>()
    const agents = mock<AgentDirectoryService>()
    const workspaces = mock<WorkspacesService>()
    access.allKnown.mockResolvedValue(true)
    store.roomByDirectKey.mockResolvedValue(null)
    store.insertRoom.mockResolvedValue(roomOf(OPENED))
    store.insertCard.mockResolvedValue({ messageId: MSG, created: true })
    workspaces.ownerIdOf.mockResolvedValue(OWNER)
    const moduleRef = await Test.createTestingModule({
        providers: [
            TeamChatCardsService,
            { provide: TeamChatStoreService, useValue: store },
            { provide: TeamChatAccessService, useValue: access },
            { provide: WorkspaceMemberSeatsService, useValue: seats },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: WorkspacesService, useValue: workspaces },
        ],
    }).compile()
    return { cards: moduleRef.get(TeamChatCardsService), store, access, seats, agents, workspaces }
}

describe("TeamChatCardsService postReport", () => {
    const report = { runId: RUN, agentId: BOT, body: "Done", roomId: NAMED }

    it("writes the report in the room the agent is configured to report to", async () => {
        const { cards, store } = await build()
        store.roomById.mockResolvedValue(roomOf(NAMED))
        await expect(cards.postReport(WS, report)).resolves.toEqual({ roomId: NAMED, messageId: MSG, created: true })
        expect(store.insertCard).toHaveBeenCalledWith({
            workspaceId: WS,
            roomId: NAMED,
            authorId: BOT,
            kind: "report",
            refId: RUN,
            body: "Done",
        })
    })

    it("opens the direct room of the agent and the owner when no room is configured, once", async () => {
        const { cards, store } = await build()
        await expect(cards.postReport(WS, { ...report, roomId: null })).resolves.toMatchObject({ roomId: OPENED })
        expect(store.insertRoom).toHaveBeenCalledWith({
            workspaceId: WS,
            createdBy: OWNER,
            kind: "direct",
            name: null,
            directKey: directKeyOf({ memberKind: "user", memberId: OWNER }, { memberKind: "agent", memberId: BOT }),
            others: [{ memberKind: "agent", memberId: BOT }],
        })
        store.roomByDirectKey.mockResolvedValue(roomOf(DIRECT))
        store.roomById.mockResolvedValue(null)
        await expect(cards.postReport(WS, report)).resolves.toMatchObject({ roomId: DIRECT })
        expect(store.insertRoom).toHaveBeenCalledTimes(1)
    })

    it("writes nothing when the workspace is gone, the agent is unknown or the card cannot be held", async () => {
        const { cards, store, access, workspaces } = await build()
        workspaces.ownerIdOf.mockResolvedValue(null)
        await expect(cards.postReport(WS, { ...report, roomId: null })).resolves.toBeNull()
        workspaces.ownerIdOf.mockResolvedValue(OWNER)
        access.allKnown.mockResolvedValue(false)
        await expect(cards.postReport(WS, { ...report, roomId: null })).resolves.toBeNull()
        store.roomById.mockResolvedValue(roomOf(NAMED))
        store.insertCard.mockResolvedValue(null)
        await expect(cards.postReport(WS, report)).resolves.toBeNull()
    })
})

describe("TeamChatCardsService postMessage", () => {
    const line = { authorAgentId: BOT, roomId: NAMED, toUserId: null, body: "  hello  ", key: "k1" }

    it("writes the trimmed line in the named room", async () => {
        const { cards, store } = await build()
        store.roomById.mockResolvedValue(roomOf(NAMED))
        store.insertLine.mockResolvedValue(MSG)
        await expect(cards.postMessage(WS, line)).resolves.toEqual({ roomId: NAMED, messageId: MSG })
        expect(store.insertLine).toHaveBeenCalledWith({
            workspaceId: WS,
            roomId: NAMED,
            authorAgentId: BOT,
            body: "hello",
            key: "k1",
            agentMessage: null,
            replyTo: null,
        })
    })

    it("writes the message a line answers (a chat turn's reply, C1)", async () => {
        const { cards, store } = await build()
        store.roomById.mockResolvedValue(roomOf(NAMED))
        store.insertLine.mockResolvedValue(MSG)
        await cards.postMessage(WS, { ...line, replyTo: "m-asked" })
        expect(store.insertLine).toHaveBeenCalledWith(expect.objectContaining({ replyTo: "m-asked" }))
    })

    it("stores the structured message of an agent line beside its words", async () => {
        const { cards, store } = await build()
        store.roomById.mockResolvedValue(roomOf(NAMED))
        store.insertLine.mockResolvedValue(MSG)
        await cards.postMessage(WS, { ...line, agentMessage: '{"kind":"order.summary"}' })
        expect(store.insertLine).toHaveBeenCalledWith(
            expect.objectContaining({ agentMessage: '{"kind":"order.summary"}' }),
        )
    })

    it("writes a line to one person in the direct room with the agent, opened on demand", async () => {
        const { cards, store } = await build()
        store.insertLine.mockResolvedValue(MSG)
        await expect(cards.postMessage(WS, { ...line, roomId: null, toUserId: ANA })).resolves.toEqual({
            roomId: OPENED,
            messageId: MSG,
        })
    })

    it("answers the line a retry finds under the same key, and nothing when there is none to find", async () => {
        const { cards, store } = await build()
        store.roomById.mockResolvedValue(roomOf(NAMED))
        store.insertLine.mockResolvedValue(null)
        store.lineKept.mockResolvedValue(MSG)
        await expect(cards.postMessage(WS, line)).resolves.toEqual({ roomId: NAMED, messageId: MSG })
        expect(store.lineKept).toHaveBeenCalledWith(NAMED, BOT, "k1")
        store.lineKept.mockResolvedValue(null)
        await expect(cards.postMessage(WS, line)).resolves.toBeNull()
        await expect(cards.postMessage(WS, { ...line, key: null })).resolves.toBeNull()
        await expect(cards.postMessage(WS, { ...line, authorAgentId: null })).resolves.toBeNull()
    })

    it("writes nothing for an empty text, a missing room, or a line with no room and no person or agent", async () => {
        const { cards, store } = await build()
        await expect(cards.postMessage(WS, { ...line, body: "   " })).resolves.toBeNull()
        store.roomById.mockResolvedValue(null)
        await expect(cards.postMessage(WS, line)).resolves.toBeNull()
        await expect(cards.postMessage(WS, { ...line, roomId: null })).resolves.toBeNull()
        await expect(
            cards.postMessage(WS, { ...line, roomId: null, toUserId: ANA, authorAgentId: null }),
        ).resolves.toBeNull()
        expect(store.insertLine).not.toHaveBeenCalled()
    })
})

describe("TeamChatCardsService postAsAgent", () => {
    const post = { agent: BOT, toUserId: ANA, body: "hello", key: "k1" }
    const found = { id: BOT, name: "Bot", module: "sales" }

    it("says the line as an agent named by id to the person, and answers which agent spoke", async () => {
        const { cards, store, agents } = await build()
        agents.activeInOrder.mockResolvedValue([found])
        store.insertLine.mockResolvedValue(MSG)
        await expect(cards.postAsAgent(WS, post)).resolves.toEqual({ roomId: OPENED, messageId: MSG, agentId: BOT })
        expect(agents.activeInOrder).toHaveBeenCalledWith(WS, [BOT], 1)
    })

    it("names the agent by the key of its module and speaks to the owner by default", async () => {
        const { cards, store, agents } = await build()
        agents.idsOfModule.mockResolvedValue([BOT])
        store.insertLine.mockResolvedValue(MSG)
        await expect(cards.postAsAgent(WS, { ...post, agent: "sales", toUserId: null })).resolves.toMatchObject({
            agentId: BOT,
        })
        expect(agents.idsOfModule).toHaveBeenCalledWith(WS, "sales", 1)
        expect(store.roomByDirectKey).toHaveBeenCalledWith(
            WS,
            directKeyOf({ memberKind: "user", memberId: OWNER }, { memberKind: "agent", memberId: BOT }),
        )
    })

    it("says nothing when the agent, the owner or the room is missing", async () => {
        const { cards, store, agents, workspaces } = await build()
        agents.activeInOrder.mockResolvedValue([])
        agents.idsOfModule.mockResolvedValue([])
        await expect(cards.postAsAgent(WS, post)).resolves.toBeNull()
        await expect(cards.postAsAgent(WS, { ...post, agent: "sales" })).resolves.toBeNull()
        agents.activeInOrder.mockResolvedValue([found])
        workspaces.ownerIdOf.mockResolvedValue(null)
        await expect(cards.postAsAgent(WS, { ...post, toUserId: null })).resolves.toBeNull()
        workspaces.ownerIdOf.mockResolvedValue(OWNER)
        store.insertLine.mockResolvedValue(null)
        await expect(cards.postAsAgent(WS, { ...post, key: null })).resolves.toBeNull()
    })
})
