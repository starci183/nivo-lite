import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { LATEST_VERSION, WORKFLOW_CALL_MEMBER, WORKFLOW_PARAMS_MEMBER } from "@nivo-lite/agent-sdk/graph"
import { WORKFLOW_TEMPLATES, latestTemplateVersion } from "@nivo-lite/blocks-core/modules"
import { AgentTagService } from "@modules/domain/agent-work"
import { ThreadRunsService } from "@modules/domain/agent-threads"
import { AgentDirectoryService } from "@modules/domain/agents"
import type { AgentCard } from "@modules/domain/agents"
import { BrainChangeRequestsService } from "@modules/domain/brain-facts"
import { takingTriggerOf } from "@modules/domain/agent-graphs/policies/workflow-trigger.policy"
import { TeamChatCardsService, TeamChatRoomsService, TeamChatStoreService } from "@modules/domain/team-chat"
import type { ChatRoomEntity, ChatRoomMessageEntity } from "@modules/domain/team-chat/persistence/entities"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import type { MemberRow } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { ChatTurnLimiterService } from "./chat-turn-limiter.service"
import type { HeardReply, PersonLineHeard } from "./team-chat-turns.contracts"
import { TEAM_CHAT_TURNS_OPTIONS } from "./team-chat-turns.decorators"
import { TeamChatTurnsService } from "./team-chat-turns.service"

const WS = "ws-1"
const OWNER = "u-owner"
const STAFF = "u-lan"
const SALES = "agent-sales"
const ACCOUNTING = "agent-acc"
const GROUP = "room-common"
const DIRECT = "room-direct-sales"

const CARDS: ReadonlyArray<AgentCard> = [
    { id: SALES, name: "Sales", module: "sales", canTagAgentIds: [] },
    { id: ACCOUNTING, name: "Kế toán", module: "accounting", canTagAgentIds: [] },
]

const PEOPLE: ReadonlyArray<MemberRow> = [
    { id: "seat-owner", user_id: OWNER, display_name: "Anh", role: "owner", status: "active" },
    { id: "seat-lan", user_id: STAFF, display_name: "Lan", role: "staff", status: "active" },
]

const AT = new Date("2026-11-11T10:00:00.000Z")

const stored = (id: string, authorKind: "user" | "agent", authorId: string, body: string, minute: number) =>
    ({ id, roomId: GROUP, workspaceId: WS, authorKind, authorId, body, createdAt: new Date(AT.getTime() + minute * 60_000) }) as unknown as ChatRoomMessageEntity

const ROOM_LINES = [stored("m-0", "user", OWNER, "chào cả nhà", 0), stored("m-1", "agent", SALES, "Dạ em đây", 1)]

/** A person's line as the team chat tells it. */
const lineOf = (over: Partial<PersonLineHeard> & { readonly body?: string } = {}): PersonLineHeard => ({
    workspaceId: WS,
    userId: OWNER,
    room: { id: GROUP, kind: "group", directKey: null },
    message: { id: "m-9", body: over.body ?? "@Sales phí ship nội thành bao nhiêu?", createdAt: AT.toISOString() },
    agentMentions: [],
    repliedTo: null,
    ...over,
})

const DIRECT_ROOM = { id: DIRECT, kind: "direct" as const, directKey: `agent:${SALES}|user:${OWNER}` }

const agentLine = (agentMessage: string | null, kind = "text"): HeardReply => ({
    id: "m-card",
    authorKind: "agent",
    authorId: ACCOUNTING,
    kind,
    agentMessage,
    body: "Báo cáo",
    createdAt: AT.toISOString(),
})

const build = async (engaged: ReadonlyArray<string> = ["sales.team-chat", "accounting.team-chat", "chatbot.team-chat"]) => {
    const tags = mock<AgentTagService>()
    const agents = mock<AgentDirectoryService>()
    const members = mock<WorkspaceMembersReadService>()
    const store = mock<TeamChatStoreService>()
    const cards = mock<TeamChatCardsService>()
    const chat = mock<TeamChatRoomsService>()
    const changes = mock<BrainChangeRequestsService>()
    const threads = mock<ThreadRunsService>()
    const clock = new FakeClock(AT)
    /** The model port of the whole path: a turn reaches it only through a wake, so it counts what a wake would cost. */
    const model = { calls: 0 }
    tags.tagAgent.mockImplementation(async (request) => {
        model.calls += 1
        return { tagged: true, wakeId: `wake-${String(request.eventKey)}` }
    })
    agents.find.mockImplementation(async (_ws, id) => CARDS.find((card) => card.id === id) ?? null)
    agents.cardsOf.mockImplementation(async (_ws, ids) => CARDS.filter((card) => ids.includes(card.id)))
    members.directory.mockResolvedValue([...PEOPLE])
    store.threadKeys.mockResolvedValue(ROOM_LINES.map((line) => ({ id: line.id, at: "0" })))
    store.messagesByIds.mockResolvedValue([...ROOM_LINES])
    threads.engages.mockImplementation((namespace) => engaged.includes(namespace))
    const moduleRef = await Test.createTestingModule({
        providers: [
            TeamChatTurnsService,
            ChatTurnLimiterService,
            { provide: AgentTagService, useValue: tags },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: WorkspaceMembersReadService, useValue: members },
            { provide: TeamChatStoreService, useValue: store },
            { provide: TeamChatCardsService, useValue: cards },
            { provide: TeamChatRoomsService, useValue: chat },
            { provide: BrainChangeRequestsService, useValue: changes },
            { provide: ThreadRunsService, useValue: threads },
            { provide: CLOCK, useValue: clock },
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: TEAM_CHAT_TURNS_OPTIONS, useValue: { limit: { turns: 2, windowMs: 60_000 } } },
        ],
    }).compile()
    const reads = () =>
        store.threadKeys.mock.calls.length +
        store.messagesByIds.mock.calls.length +
        members.directory.mock.calls.length +
        agents.find.mock.calls.length
    return { service: moduleRef.get(TeamChatTurnsService), tags, store, cards, chat, changes, clock, model, reads }
}

/** The params a started turn carried. */
const paramsOf = (call: unknown): Readonly<Record<string, unknown>> => {
    const context: unknown = Reflect.get(call as object, "context")
    return Reflect.get(context as object, WORKFLOW_PARAMS_MEMBER) as Readonly<Record<string, unknown>>
}

describe("TeamChatTurnsService: the common-room rule", () => {
    it("private room: every message is for the room's agent, ONE pinned turn of team-chat with the asker's standing", async () => {
        const { service, tags } = await build()

        await expect(service.heard(lineOf({ room: DIRECT_ROOM, body: "Phí ship nội thành bao nhiêu em?" }))).resolves.toEqual([SALES])

        expect(tags.tagAgent).toHaveBeenCalledTimes(1)
        const [request] = tags.tagAgent.mock.calls[0] ?? []
        expect(request).toMatchObject({
            workspaceId: WS,
            toAgentId: SALES,
            personId: "seat-owner",
            subject: `chat-room:${DIRECT}`,
            eventKey: `chat-turn:m-9:${SALES}`,
            context: { [WORKFLOW_CALL_MEMBER]: { workflow: "team-chat", version: LATEST_VERSION } },
        })
        expect(paramsOf(request)).toMatchObject({
            roomId: DIRECT,
            messageId: "m-9",
            text: "Phí ship nội thành bao nhiêu em?",
            room: "direct",
            intent: "answer",
            asker: { name: "Anh", standing: "owner" },
            replyTo: null,
            locale: "vi",
        })
        expect(paramsOf(request)["lines"]).toEqual([
            { id: "m-0", by: "person", name: "Anh", text: "chào cả nhà", at: "2026-11-11T10:00:00.000Z" },
            { id: "m-1", by: "agent", name: "Sales", text: "Dạ em đây", at: "2026-11-11T10:01:00.000Z" },
        ])
    })

    it("common room, a message that names nobody: no turn, no read, no model call", async () => {
        const { service, tags, model, reads } = await build()

        await expect(service.heard(lineOf({ body: "mọi người ăn trưa chưa" }))).resolves.toEqual([])

        expect(tags.tagAgent).not.toHaveBeenCalled()
        expect(reads()).toBe(0)
        expect(model.calls).toBe(0)
    })

    it("two agents named: two turns, in the order written, once each", async () => {
        const { service, tags } = await build()

        await expect(
            service.heard(lineOf({ agentMentions: [ACCOUNTING, SALES, ACCOUNTING], body: "@Kế toán @Sales hôm nay sao rồi?" })),
        ).resolves.toEqual([ACCOUNTING, SALES])

        expect(tags.tagAgent.mock.calls.map(([request]) => request.toAgentId)).toEqual([ACCOUNTING, SALES])
    })

    it("a reply to an agent's line (a report card): that agent answers, with the line it replies to", async () => {
        const { service, tags } = await build()
        const report = agentLine(JSON.stringify({ kind: "report.daily", intent: "report" }), "text")

        await expect(service.heard(lineOf({ body: "sao hôm nay ít đơn vậy?", repliedTo: report }))).resolves.toEqual([ACCOUNTING])

        const [request] = tags.tagAgent.mock.calls[0] ?? []
        expect(paramsOf(request)["replyTo"]).toMatchObject({ id: "m-card", by: "agent", name: "Kế toán", text: "Báo cáo" })
    })

    it("a reply to a card a person decides on (stop, truth change, approval) is that card's door: no chat turn", async () => {
        const { service, tags } = await build()

        for (const card of [
            agentLine(JSON.stringify({ kind: "workflow.stopped" })),
            agentLine(JSON.stringify({ kind: "brain.change" })),
            agentLine(null, "approval"),
        ])
            await expect(service.heard(lineOf({ body: "Giữ đơn mở nhé", repliedTo: card }))).resolves.toEqual([])

        expect(tags.tagAgent).not.toHaveBeenCalled()
    })

    it("an agent's own line, a reply to a person, or a message with no words starts no turn: agents never answer agents", async () => {
        const { service, tags, model } = await build()
        const person: HeardReply = { ...agentLine(null), authorKind: "user", authorId: STAFF }

        await expect(service.heard(lineOf({ body: "ok", repliedTo: person }))).resolves.toEqual([])
        await expect(service.heard(lineOf({ body: "  ", agentMentions: [SALES] }))).resolves.toEqual([])

        expect(tags.tagAgent).not.toHaveBeenCalled()
        expect(model.calls).toBe(0)
    })

    it("staff ask with their own standing: the turn carries `staff`, so the answer is read with their rights", async () => {
        const { service, tags } = await build()

        await service.heard(lineOf({ userId: STAFF, agentMentions: [ACCOUNTING], body: "@Kế toán doanh thu hôm nay bao nhiêu?" }))

        expect(paramsOf(tags.tagAgent.mock.calls[0]?.[0])["asker"]).toEqual({ name: "Lan", standing: "staff" })
    })

    it("an agent whose chat turn is not on threads keeps the old tag path: the router takes nothing", async () => {
        const { service, tags } = await build([])

        await expect(service.heard(lineOf({ agentMentions: [SALES] }))).resolves.toEqual([])

        expect(tags.tagAgent).not.toHaveBeenCalled()
    })

    it("rate limit per room: over the limit the agent says ONE line, then stays quiet for the window", async () => {
        const { service, tags, cards, clock } = await build()
        const say = (id: string) => service.heard({ ...lineOf({ agentMentions: [SALES] }), message: { id, body: "@Sales ?", createdAt: AT.toISOString() } })

        await say("m-a")
        await say("m-b")
        await expect(say("m-c")).resolves.toEqual([SALES])
        await expect(say("m-d")).resolves.toEqual([SALES])

        expect(tags.tagAgent).toHaveBeenCalledTimes(2)
        expect(cards.postMessage).toHaveBeenCalledTimes(1)
        expect(cards.postMessage.mock.calls[0]?.[1]).toMatchObject({ authorAgentId: SALES, roomId: GROUP, key: "chat-pause:m-c" })
        const typed = JSON.parse(String(cards.postMessage.mock.calls[0]?.[1].agentMessage)) as { readonly kind: string }
        expect(typed.kind).toBe("message.text")

        clock.advance(61_000)
        await say("m-e")
        expect(tags.tagAgent).toHaveBeenCalledTimes(3)
    })

    it("a customer's conversation is never a chat turn: no channel or system wake can route to the team-chat workflow", () => {
        const chatTurns = WORKFLOW_TEMPLATES.filter((template) => template.id.endsWith(".team-chat"))
        expect(chatTurns.map((template) => template.id).sort()).toEqual(["accounting.team-chat", "chatbot.team-chat", "sales.team-chat"])
        for (const template of chatTurns) {
            const graph = latestTemplateVersion(template).graph
            for (const source of ["channel", "system-event", "chats-group", "schedule"])
                expect(takingTriggerOf(graph, source, { conversationId: "c1", channel: "zalo", text: "hi" })).toBeNull()
            expect(template.primary).toBe(false)
        }
    })
})

describe("TeamChatTurnsService: Ghi vào Second Brain", () => {
    const message = stored("m-rule", "user", OWNER, "từ mai phí ship nội thành là 30k nhé", 3)
    const room = { id: DIRECT, kind: "direct", directKey: `agent:${SALES}|user:${OWNER}` } as unknown as ChatRoomEntity

    const ready = async () => {
        const world = await build()
        world.store.messagesByIds.mockResolvedValue([{ ...message, roomId: DIRECT } as ChatRoomMessageEntity])
        world.store.roomById.mockResolvedValue(room)
        world.chat.room.mockResolvedValue({ id: DIRECT } as Awaited<ReturnType<TeamChatRoomsService["room"]>>)
        return world
    }

    it("the owner names the truth: filed at once through the change requests, the quoted line as evidence, a reason, no AI", async () => {
        const { service, changes, tags, model } = await ready()
        changes.propose.mockResolvedValue({ outcome: "filed", fact: {} as never })

        await expect(
            service.capture(WS, OWNER, {
                messageId: "m-rule",
                agentId: null,
                fact: { subjectLabel: "Giao hàng", attributeLabel: "Phí ship nội thành", value: "30.000 đ", unit: null, validFrom: null, validTo: null },
            }),
        ).resolves.toBe("filed")

        expect(changes.propose).toHaveBeenCalledWith(WS, expect.objectContaining({
            subjectLabel: "Giao hàng",
            value: "30.000 đ",
            room: "direct",
            messageId: "m-rule",
            quote: "từ mai phí ship nội thành là 30k nhé",
            proposedBy: "sales",
            agentId: SALES,
        }))
        const [, filed] = changes.propose.mock.calls[0] ?? []
        expect(filed?.reason).toContain("Ghi vào Second Brain")
        expect(tags.tagAgent).not.toHaveBeenCalled()
        expect(model.calls).toBe(0)
    })

    it("without the truth named, the agent drafts it in a capture turn; staff may not press it", async () => {
        const { service, tags } = await ready()

        await expect(service.capture(WS, OWNER, { messageId: "m-rule", agentId: null, fact: null })).resolves.toBe("drafting")
        expect(paramsOf(tags.tagAgent.mock.calls[0]?.[0])).toMatchObject({ intent: "capture", messageId: "m-rule" })
        expect(tags.tagAgent.mock.calls[0]?.[0].eventKey).toBe(`chat-capture:m-rule:${SALES}`)

        await expect(service.capture(WS, STAFF, { messageId: "m-rule", agentId: null, fact: null })).resolves.toBe("not_allowed")
        expect(tags.tagAgent).toHaveBeenCalledTimes(1)
    })
})
