import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { AGENTS_INSTALLATIONS, AgentDirectoryService } from "@modules/domain/agents"
import type { AgentTurnFacts, Installation, InstallationDirectory } from "@modules/domain/agents"
import { CLOCK } from "@modules/platform/clock"
import { CHAT_WORKSPACE, addConversation, fakeChat } from "../../../tests/fixtures/builders/chat-records.builder"
import type { FakeChat } from "../../../tests/fixtures/builders/chat-records.builder"
import { ChatConversationsService } from "./chat-conversations.service"
import { ChatEntitiesService } from "./chat-entities.service"
import { ChatRecordsErrorCode } from "./errors/chat-records.error"

const CONNECTION = "22222222-2222-4222-8222-222222222222"
const AGENT = "33333333-3333-4333-8333-333333333333"
const OTHER_AGENT = "44444444-4444-4444-8444-444444444444"
const LEAD = "55555555-5555-4555-8555-555555555555"
const NOT_FOUND = { kind: "refused", code: ChatRecordsErrorCode.NotFound }

const agentFacts = (id: string, name: string): AgentTurnFacts => ({
    id,
    name,
    handle: name.toLowerCase(),
    role: "sales",
    module: "chatbot",
    instructions: "",
    knowledge: "",
    approvalRule: "",
    greeting: "",
})

const build = async (chat: FakeChat) => {
    const agents = mock<AgentDirectoryService>()
    agents.turnFactsOf.mockImplementation((id) => Promise.resolve(agentFacts(id, id === AGENT ? "Front" : "Sales")))
    const installations = mock<InstallationDirectory>()
    installations.ofAgent.mockResolvedValue(null)
    const entities = mock<ChatEntitiesService>()
    entities.run.mockImplementation((_workspace, work) => work(chat.api))
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChatConversationsService,
            { provide: ChatEntitiesService, useValue: entities },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: AGENTS_INSTALLATIONS, useValue: installations },
            { provide: CLOCK, useValue: new FakeClock("2026-11-06T03:00:00.000Z") },
        ],
    }).compile()
    return { service: moduleRef.get(ChatConversationsService), agents, installations }
}

const open = {
    workspaceId: CHAT_WORKSPACE,
    agentId: AGENT,
    channel: "telegram",
    customerId: "c1",
    visitor: "An",
    connectionId: CONNECTION,
}

describe("ChatConversationsService: meeting a customer", () => {
    it("opens the conversation on the first meeting and finds it on the second", async () => {
        const chat = fakeChat()
        const { service } = await build(chat)
        const first = await service.meet(open)
        const second = await service.meet(open)
        expect(first.created).toBe(true)
        expect(first.conversation).toEqual({
            id: [...(chat.rows.get("chat.conversation")?.keys() ?? [])][0],
            agentId: AGENT,
            leadId: null,
            handledBy: null,
            visitorName: "An",
        })
        expect(second).toEqual({ created: false, conversation: first.conversation })
        expect(chat.rows.get("chat.conversation")?.size).toBe(1)
    })

    it("follows the conversation to the current front agent of the connection", async () => {
        const chat = fakeChat()
        const { service } = await build(chat)
        await service.meet(open)
        const moved = await service.meet({ ...open, agentId: OTHER_AGENT })
        expect(moved.created).toBe(false)
        expect(moved.conversation.agentId).toBe(OTHER_AGENT)
    })

    it("refuses a meeting the engine did not store or that cannot be read back", async () => {
        const chat = fakeChat()
        const { service } = await build(chat)
        const unreadable = await addConversation(chat, { agentId: null })
        chat.api.ensure = () => Promise.resolve({ ok: true, row: unreadable, version: "1", created: true })
        await expect(service.meet(open)).rejects.toMatchObject({ code: ChatRecordsErrorCode.NotStored })
        chat.api.ensure = () => Promise.resolve({ ok: false, reason: "invalid" })
        await expect(service.meet(open)).rejects.toMatchObject({ code: ChatRecordsErrorCode.NotStored })
    })

    it("finds a customer conversation or refuses when they never wrote", async () => {
        const chat = fakeChat()
        const { service } = await build(chat)
        await addConversation(chat)
        expect(await service.find(CHAT_WORKSPACE, "telegram", CONNECTION, "c1")).toMatchObject({ kind: "ok" })
        expect(await service.find(CHAT_WORKSPACE, "telegram", CONNECTION, "zz")).toEqual(NOT_FOUND)
    })

    it("archives the conversation under another id and ignores a customer who never wrote", async () => {
        const chat = fakeChat()
        const { service } = await build(chat)
        const row = await addConversation(chat)
        await service.archive(CHAT_WORKSPACE, "telegram", CONNECTION, "c1", "c1:2026")
        await service.archive(CHAT_WORKSPACE, "telegram", CONNECTION, "nobody", "x")
        expect(chat.rows.get("chat.conversation")?.get(row.id)?.data).toMatchObject({ externalId: "c1:2026" })
    })
})

describe("ChatConversationsService: changing a conversation", () => {
    it("names the customer, restarting a write another writer outran", async () => {
        const chat = fakeChat()
        const { service } = await build(chat)
        const row = await addConversation(chat)
        chat.staleFor("chat.conversation", 1)
        await service.rename(CHAT_WORKSPACE, row.id, "Binh")
        expect(chat.rows.get("chat.conversation")?.get(row.id)?.data).toMatchObject({ name: "Binh" })
    })

    it("gives up after three lost races, on a missing conversation and on a refused write", async () => {
        const chat = fakeChat()
        const { service } = await build(chat)
        const row = await addConversation(chat)
        chat.staleFor("chat.conversation", 3)
        await expect(service.rename(CHAT_WORKSPACE, row.id, "Cuong")).rejects.toMatchObject({
            code: ChatRecordsErrorCode.NotStored,
        })
        await expect(service.rename(CHAT_WORKSPACE, "gone", "x")).rejects.toMatchObject({
            code: ChatRecordsErrorCode.NotFound,
        })
        chat.api.update = () => Promise.resolve({ ok: false, reason: "invalid" })
        await expect(service.rename(CHAT_WORKSPACE, row.id, "x")).rejects.toMatchObject({
            code: ChatRecordsErrorCode.NotStored,
        })
    })

    it("links the lead the customer became and refuses a conversation that is gone", async () => {
        const chat = fakeChat()
        const { service } = await build(chat)
        const row = await addConversation(chat)
        await service.attachLead(CHAT_WORKSPACE, row.id, LEAD)
        expect(chat.links.get(`chat.conversation:${row.id}:lead`)).toBe(LEAD)
        expect((await service.humanOf(CHAT_WORKSPACE, row.id))?.leadId).toBe(LEAD)
        // The nodes find a customer's conversation by the field, not the link: both are written.
        expect((await chat.api.get("chat.conversation", row.id))?.data.leadId).toBe(LEAD)
        await expect(service.attachLead(CHAT_WORKSPACE, "gone", LEAD)).rejects.toMatchObject({
            code: ChatRecordsErrorCode.NotFound,
        })
    })

    it("holds the conversation for a person and hands it back, with the marks that follow", async () => {
        const chat = fakeChat()
        const { service } = await build(chat)
        const row = await addConversation(chat)
        await service.setHolder(CHAT_WORKSPACE, row.id, "Lan")
        expect(chat.rows.get("chat.conversation")?.get(row.id)?.data).toMatchObject({
            handledBy: "Lan",
            status: "handled",
            handledAt: "2026-11-06T03:00:00.000Z",
        })
        await service.setHolder(CHAT_WORKSPACE, row.id, null)
        expect(chat.rows.get("chat.conversation")?.get(row.id)?.data).toMatchObject({
            handledBy: null,
            status: "ai",
            handledAt: null,
        })
    })

    it("remembers the connector party, the latest answer winning", async () => {
        const chat = fakeChat()
        const { service } = await build(chat)
        const row = await addConversation(chat)
        expect(await service.partyOf(CHAT_WORKSPACE, row.id)).toBeNull()
        await service.rememberParty(CHAT_WORKSPACE, row.id, { partyId: "p1", name: "Cty A" })
        expect(await service.partyOf(CHAT_WORKSPACE, row.id)).toEqual({ partyId: "p1", name: "Cty A" })
        await service.rememberParty(CHAT_WORKSPACE, row.id, { partyId: "p2", name: "" })
        expect(await service.partyOf(CHAT_WORKSPACE, row.id)).toEqual({ partyId: "p2", name: "" })
        expect(await service.partyOf(CHAT_WORKSPACE, "gone")).toBeNull()
    })

    it("reads a remembered party with no name as an empty name", async () => {
        const chat = fakeChat()
        const { service } = await build(chat)
        const row = await addConversation(chat, { connectorPartyId: "p9" })
        expect(await service.partyOf(CHAT_WORKSPACE, row.id)).toEqual({ partyId: "p9", name: "" })
    })
})

describe("ChatConversationsService: reading a conversation", () => {
    it("answers where the replies go, who may hold it, and nothing for a conversation that is not there", async () => {
        const chat = fakeChat()
        const { service } = await build(chat)
        const row = await addConversation(chat)
        expect(await service.targetOf(CHAT_WORKSPACE, row.id)).toEqual({
            kind: "ok",
            value: {
                id: row.id,
                workspaceId: CHAT_WORKSPACE,
                channel: "telegram",
                externalId: "c1",
                connectionId: CONNECTION,
            },
        })
        expect(await service.targetOf(CHAT_WORKSPACE, "gone")).toEqual(NOT_FOUND)
        expect(await service.humanOf(CHAT_WORKSPACE, "gone")).toBeNull()
        expect(await service.humanOf(CHAT_WORKSPACE, row.id)).toMatchObject({ handledBy: null, leadId: null })
    })

    it("answers the turn with the speaking agent, the installation and the front agent name after a hand-over", async () => {
        const chat = fakeChat()
        const { service, installations } = await build(chat)
        installations.ofAgent.mockResolvedValue(mock<Installation>({ id: "inst-1" }))
        const row = await addConversation(chat, { agentId: OTHER_AGENT, frontAgentId: AGENT })
        expect(await service.turnOf(CHAT_WORKSPACE, row.id)).toMatchObject({
            kind: "ok",
            value: { id: row.id, installationId: "inst-1", speaksAs: "Front", agent: { id: OTHER_AGENT } },
        })
    })

    it("answers no speaksAs while the front agent speaks, and a refusal when the conversation or its agent is gone", async () => {
        const chat = fakeChat()
        const { service, agents } = await build(chat)
        const row = await addConversation(chat, { frontAgentId: AGENT })
        expect(await service.turnOf(CHAT_WORKSPACE, row.id)).toMatchObject({
            kind: "ok",
            value: { speaksAs: null, installationId: null },
        })
        expect(await service.turnOf(CHAT_WORKSPACE, "gone")).toEqual(NOT_FOUND)
        agents.turnFactsOf.mockResolvedValue(null)
        expect(await service.turnOf(CHAT_WORKSPACE, row.id)).toEqual(NOT_FOUND)
    })
})

describe("ChatConversationsService: followers of a connection", () => {
    const since = new Date("2026-11-04T03:00:00.000Z")
    const query = { channel: "zalo", connectionId: CONNECTION, since, limit: 1 }

    it("lists the customers who wrote after the moment, newest first, at most the limit", async () => {
        const chat = fakeChat()
        const { service } = await build(chat)
        const old = await addConversation(chat, {
            channel: "zalo",
            externalId: "u0",
            lastAt: "2026-11-01T00:00:00.000Z",
        })
        const first = await addConversation(chat, {
            channel: "zalo",
            externalId: "u1",
            lastAt: "2026-11-05T00:00:00.000Z",
        })
        const second = await addConversation(chat, {
            channel: "zalo",
            externalId: "u2",
            lastAt: "2026-11-06T00:00:00.000Z",
        })
        await addConversation(chat, { channel: "telegram", externalId: "t1", lastAt: "2026-11-06T00:00:00.000Z" })
        const say = (conversationId: string, sentAt: string) =>
            chat.api.insert("chat.message", { conversationId, role: "user", text: "hi", sentAt })
        await say(old.id, "2026-11-01T00:00:00.000Z")
        await say(first.id, "2026-11-05T00:00:00.000Z")
        await say(second.id, "2026-11-06T00:00:00.000Z")
        expect(await service.followersOn(CHAT_WORKSPACE, query)).toEqual([
            { conversationId: second.id, externalId: "u2", name: "An", lastAt: "2026-11-06T00:00:00.000Z" },
        ])
        const both = await service.followersOn(CHAT_WORKSPACE, { ...query, limit: 10 })
        expect(both.map((one) => one.externalId)).toEqual(["u2", "u1"])
    })

    it("leaves out a conversation no agent speaks in", async () => {
        const chat = fakeChat()
        const { service } = await build(chat)
        await addConversation(chat, { channel: "zalo", agentId: null, lastAt: "2026-11-06T00:00:00.000Z" })
        expect(await service.followersOn(CHAT_WORKSPACE, query)).toEqual([])
    })

    it("answers nobody when no conversation of the connection was active after the moment", async () => {
        const chat = fakeChat()
        const { service } = await build(chat)
        await addConversation(chat, { channel: "zalo", lastAt: "2026-11-01T00:00:00.000Z" })
        expect(await service.followersOn(CHAT_WORKSPACE, query)).toEqual([])
    })
})

describe("ChatConversationsService: conversations by id and by lead", () => {
    it("reads the conversations among the ids in one pass, leaving out an id that is not there", async () => {
        const chat = fakeChat()
        const { service } = await build(chat)
        const one = await addConversation(chat, { externalId: "u1" })
        const two = await addConversation(chat, { externalId: "u2", handledBy: "Lan" })
        const unreadable = await addConversation(chat, { externalId: "u3", agentId: null })
        const answer = await service.humansOf(CHAT_WORKSPACE, [one.id, two.id, unreadable.id, "gone"])
        expect(answer.map((human) => [human.id, human.handledBy])).toEqual([
            [two.id, "Lan"],
            [one.id, null],
        ])
        expect(await service.humansOf(CHAT_WORKSPACE, [])).toEqual([])
    })

    it("splits a long list of ids into pages of at most one hundred", async () => {
        const chat = fakeChat()
        const { service } = await build(chat)
        const row = await addConversation(chat)
        const list = chat.api.list
        const sizes: Array<number> = []
        chat.api.list = (query) => {
            sizes.push(query.page.size)
            return list(query)
        }
        const ids = [...Array.from({ length: 100 }, (_, index) => `gone-${String(index)}`), row.id]
        expect((await service.humansOf(CHAT_WORKSPACE, ids)).map((human) => human.id)).toEqual([row.id])
        expect(sizes).toEqual([100, 1])
    })

    it("finds the conversations tied to the leads, newest first, and nothing for no leads", async () => {
        const chat = fakeChat()
        const { service } = await build(chat)
        const old = await addConversation(chat, { externalId: "u1", lastAt: "2026-11-01T00:00:00.000Z" })
        const recent = await addConversation(chat, { externalId: "u2", lastAt: "2026-11-05T00:00:00.000Z" })
        await addConversation(chat, { externalId: "u3", lastAt: "2026-11-06T00:00:00.000Z" })
        const unreadable = await addConversation(chat, { externalId: "u4", agentId: null })
        await chat.api.link("chat.conversation", unreadable.id, "lead", LEAD)
        await chat.api.link("chat.conversation", old.id, "lead", LEAD)
        await chat.api.link("chat.conversation", recent.id, "lead", LEAD)
        const answer = await service.ofLeads(CHAT_WORKSPACE, [LEAD])
        expect(answer.map((human) => [human.id, human.leadId])).toEqual([
            [recent.id, LEAD],
            [old.id, LEAD],
        ])
        expect(await service.ofLeads(CHAT_WORKSPACE, [])).toEqual([])
        expect(await service.ofLeads(CHAT_WORKSPACE, ["other-lead"])).toEqual([])
    })

    it("follows the pages of the newest conversations and stops after twenty", async () => {
        const chat = fakeChat()
        const { service } = await build(chat)
        const row = await addConversation(chat)
        await chat.api.link("chat.conversation", row.id, "lead", LEAD)
        const list = chat.api.list
        const cursors: Array<string | undefined> = []
        chat.api.list = async (query) => {
            cursors.push(query.page.after)
            return { ...(await list(query)), next: `page-${String(cursors.length)}` }
        }
        expect((await service.ofLeads(CHAT_WORKSPACE, [LEAD])).length).toBe(20)
        expect(cursors).toHaveLength(20)
        expect(cursors.slice(0, 3)).toEqual([undefined, "page-1", "page-2"])
    })
})

describe("ChatConversationsService: whether the workspace has talked", () => {
    it("answers false before any customer wrote and true after the first conversation", async () => {
        const chat = fakeChat()
        const { service } = await build(chat)
        expect(await service.hasAny(CHAT_WORKSPACE)).toBe(false)
        await addConversation(chat)
        expect(await service.hasAny(CHAT_WORKSPACE)).toBe(true)
    })
})

describe("ChatConversationsService: the lead and the installation of a conversation", () => {
    it("answers the lead a conversation became, or null for none or for a conversation that is not there", async () => {
        const chat = fakeChat()
        const { service } = await build(chat)
        const row = await addConversation(chat)
        expect(await service.leadIdOf(CHAT_WORKSPACE, row.id)).toBeNull()
        await service.attachLead(CHAT_WORKSPACE, row.id, LEAD)
        expect(await service.leadIdOf(CHAT_WORKSPACE, row.id)).toBe(LEAD)
        expect(await service.leadIdOf(CHAT_WORKSPACE, "gone")).toBeNull()
    })

    it("answers the installation of the agent that speaks, or null without one or without the conversation", async () => {
        const chat = fakeChat()
        const { service, installations } = await build(chat)
        const row = await addConversation(chat)
        expect(await service.installationIdOf(CHAT_WORKSPACE, row.id)).toBeNull()
        installations.ofAgent.mockResolvedValue(mock<Installation>({ id: "inst-2" }))
        expect(await service.installationIdOf(CHAT_WORKSPACE, row.id)).toBe("inst-2")
        expect(await service.installationIdOf(CHAT_WORKSPACE, "gone")).toBeNull()
    })
})
