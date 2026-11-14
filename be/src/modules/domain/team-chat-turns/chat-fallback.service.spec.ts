import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { LATEST_VERSION } from "@nivo-lite/agent-sdk/graph"
import type { DeliverResult } from "@modules/domain/provider-triggers"
import { ProviderTriggersService } from "@modules/domain/provider-triggers"
import { AgentDirectoryService, type AgentCard } from "@modules/domain/agents"
import { NodeRightsSwitchService } from "@modules/domain/tool-grants"
import {
    TeamChatCardsService,
    TeamChatStoreService,
    type HeardReply,
    type PersonLineHeard,
} from "@modules/domain/team-chat"
import { WorkspaceMembersReadService, type MemberRow } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { parseJsonText } from "@modules/platform/primitives"
import { REPORT_BODY_VI, SALES_SHIP_FEE_ASK_VI } from "@tests/fixtures/i18n/team-chat-turns-spec.messages"
import { ChatFallbackService } from "./chat-fallback.service"
import { ChatTurnLimiterService } from "./chat-turn-limiter.service"
import { TeamChatTurnsLogEvent } from "./team-chat-turns.log-events"
import { unhandledLineOf } from "./team-chat-turns.policy"
import { TeamChatTurnsService } from "./team-chat-turns.service"

// The fallback behind the REAL router: what a workspace's switch changes for a person's message in /chat, end to end.

const WS = "ws-1"
const OWNER = "u-owner"
const SALES = "agent-sales"
const ACCOUNTING = "agent-acc"
/** An agent of a module that ships no chat turn. */
const MARKETING = "agent-mkt"
/** An id that is no agent of the workspace. */
const GONE = "agent-gone"
const GROUP = "room-common"
const AT = "2026-11-12T10:00:00.000Z"

const CARDS: ReadonlyArray<AgentCard> = [
    { id: SALES, name: "Sales", module: "sales" },
    { id: ACCOUNTING, name: "Accounting", module: "accounting" },
    { id: MARKETING, name: "Marketing", module: "marketing" },
]

const PEOPLE: ReadonlyArray<MemberRow> = [
    { id: "seat-owner", user_id: OWNER, display_name: "Anh", role: "owner", status: "active" },
]

const lineOf = (over: Partial<PersonLineHeard> = {}): PersonLineHeard => ({
    workspaceId: WS,
    userId: OWNER,
    room: { id: GROUP, kind: "group", directKey: null },
    message: { id: "m-9", body: SALES_SHIP_FEE_ASK_VI, createdAt: AT },
    agentMentions: [],
    repliedTo: null,
    ...over,
})

/** A stop card of the accounting agent: a reply to it is that card's own door, never a chat turn. */
const STOP_CARD: HeardReply = {
    id: "m-card",
    authorKind: "agent",
    authorId: ACCOUNTING,
    kind: "text",
    agentMessage: JSON.stringify({ kind: "workflow.stopped" }),
    body: REPORT_BODY_VI,
    createdAt: AT,
}

/** The fallback alone: its switch (absent = an app without the switch reader), the chat's cards and the logger. */
const buildFallback = async (decides?: boolean) => {
    const cards = mock<TeamChatCardsService>()
    const logger = mock<Logger>()
    const switches = mock<NodeRightsSwitchService>()
    switches.decides.mockResolvedValue(decides === true)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChatFallbackService,
            { provide: TeamChatCardsService, useValue: cards },
            { provide: LOGGER, useValue: logger },
            ...(decides === undefined ? [] : [{ provide: NodeRightsSwitchService, useValue: switches }]),
        ],
    }).compile()
    return { fallback: moduleRef.get(ChatFallbackService), cards, logger, switches }
}

/** What the delivery answers: a wake written for the turn, the same turn delivered before, or no registration taking it. */
const DELIVERED = (over: Partial<Extract<DeliverResult, { status: "delivered" }>>): DeliverResult => ({
    status: "delivered",
    events: 1,
    dropped: 0,
    woken: [],
    repeats: 0,
    untaken: 0,
    held: 0,
    ...over,
})

/** The real router with the fallback behind it; its own collaborators doubled. */
const build = async (decides?: boolean) => {
    const { fallback, cards, logger, switches } = await buildFallback(decides)
    const triggers = mock<ProviderTriggersService>()
    triggers.deliver.mockResolvedValue(DELIVERED({ woken: [{ agentId: SALES, workflowId: "w-1", eventId: "turn", wakeId: "wake-1" }] }))
    const agents = mock<AgentDirectoryService>()
    agents.find.mockImplementation((_ws, id) => Promise.resolve(CARDS.find((card) => card.id === id) ?? null))
    agents.cardsOf.mockResolvedValue([])
    const members = mock<WorkspaceMembersReadService>()
    members.directory.mockResolvedValue([...PEOPLE])
    const store = mock<TeamChatStoreService>()
    store.threadKeys.mockResolvedValue([])
    store.messagesByIds.mockResolvedValue([])
    const limiter = mock<ChatTurnLimiterService>()
    limiter.admit.mockReturnValue("run")
    const moduleRef = await Test.createTestingModule({
        providers: [
            TeamChatTurnsService,
            { provide: ChatTurnLimiterService, useValue: limiter },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: fakeTransaction(mockEntityManager({})).em },
            { provide: ProviderTriggersService, useValue: triggers },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: WorkspaceMembersReadService, useValue: members },
            { provide: TeamChatStoreService, useValue: store },
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: ChatFallbackService, useValue: fallback },
        ],
    }).compile()
    return { service: moduleRef.get(TeamChatTurnsService), triggers, agents, members, cards, logger, switches }
}

/** The cards double of a built world. */
type Cards = Awaited<ReturnType<typeof build>>["cards"]

/** The agents and codes the one posted line carries. */
const unroutedIn = (cards: Cards): unknown => {
    const read = parseJsonText(cards.postMessage.mock.calls[0]?.[1].agentMessage ?? "")
    const payload: unknown =
        read.ok && typeof read.value === "object" && read.value !== null ? Reflect.get(read.value, "payload") : null
    return typeof payload === "object" && payload !== null ? Reflect.get(payload, "unrouted") : null
}

describe("ChatFallbackService with the node rights switched OFF: the old tag path runs as before", () => {
    it.each<[string, boolean | undefined]>([
        ["the switch off", false],
        ["an app without the switch", undefined],
    ])(
        "%s: an agent whose turn did not start is left to the old tag path, and nothing is written",
        async (_name, decides) => {
            const { service, triggers, agents, cards } = await build(decides)

            // No chat turn shipped, no such agent, and a router that fails: each leaves the agent out of the answer.
            await expect(service.heard(lineOf({ agentMentions: [MARKETING] }))).resolves.toEqual([])
            await expect(service.heard(lineOf({ agentMentions: [GONE] }))).resolves.toEqual([])
            // A reply to a card a person decides on that also names an agent: no turn, the old path keeps the mention.
            await expect(service.heard(lineOf({ agentMentions: [SALES], repliedTo: STOP_CARD }))).resolves.toEqual([])
            agents.find.mockRejectedValueOnce(new TypeError("directory down"))
            await expect(service.heard(lineOf({ agentMentions: [SALES] }))).resolves.toEqual([])

            expect(triggers.deliver).not.toHaveBeenCalled()
            expect(cards.postMessage).not.toHaveBeenCalled()
        },
    )

    it("the switch off: a turn that starts is taken, exactly as before", async () => {
        const { service, cards } = await build(false)

        await expect(service.heard(lineOf({ agentMentions: [SALES] }))).resolves.toEqual([SALES])

        expect(cards.postMessage).not.toHaveBeenCalled()
    })

    it("says the path is open, and hands back only the turns taken", async () => {
        const off = await buildFallback(false)
        const absent = await buildFallback()

        await expect(off.fallback.closed(WS)).resolves.toBe(false)
        await expect(absent.fallback.closed(WS)).resolves.toBe(false)
        await expect(off.fallback.shut(lineOf(), [SALES], [])).resolves.toEqual([SALES])

        expect(off.switches.decides).toHaveBeenCalledWith(WS)
        expect(off.cards.postMessage).not.toHaveBeenCalled()
    })
})

describe("ChatFallbackService with the node rights switched ON: an agent whose turn did not start gets no tag", () => {
    it("a turn that starts is a workflow call PINNED to the team-chat workflow, and no line is written", async () => {
        const { service, triggers, cards } = await build(true)

        await expect(service.heard(lineOf({ agentMentions: [SALES] }))).resolves.toEqual([SALES])

        expect(triggers.deliver).toHaveBeenCalledTimes(1)
        expect(triggers.deliver.mock.calls[0]?.[0].events[0]?.pin).toEqual({
            workflow: "team-chat",
            version: LATEST_VERSION,
        })
        expect(cards.postMessage).not.toHaveBeenCalled()
    })

    it.each<[string, string, string]>([
        ["whose module ships no chat turn", MARKETING, "no_chat_turn"],
        ["that is no agent of the workspace", GONE, "no_agent"],
    ])("an agent %s: the old path is told to skip it and NIVO says nothing ran", async (_name, agentId, code) => {
        const { service, triggers, cards, logger } = await build(true)

        await expect(service.heard(lineOf({ agentMentions: [agentId] }))).resolves.toEqual([agentId])

        expect(triggers.deliver).not.toHaveBeenCalled()
        expect(cards.postMessage).toHaveBeenCalledTimes(1)
        expect(cards.postMessage).toHaveBeenCalledWith(
            WS,
            expect.objectContaining({
                // NIVO speaks, never the agent: nobody answers in its place.
                authorAgentId: null,
                roomId: GROUP,
                toUserId: null,
                body: unhandledLineOf("vi").text,
                key: "chat-unhandled:m-9",
                replyTo: "m-9",
            }),
        )
        expect(unroutedIn(cards)).toEqual([{ agentId, code }])
        expect(logger.warn).toHaveBeenCalledWith(TeamChatTurnsLogEvent.FallbackClosed, {
            roomId: GROUP,
            count: 1,
            codes: [code],
        })
    })

    it("a call the delivery wrote no wake for (the asker is no active member, or no registration took it) is not handed to the old path", async () => {
        const refused = await build(true)
        refused.triggers.deliver.mockResolvedValue(DELIVERED({ untaken: 1 }))
        const stranger = await build(true)
        stranger.members.directory.mockResolvedValue([])

        await expect(refused.service.heard(lineOf({ agentMentions: [SALES] }))).resolves.toEqual([SALES])
        await expect(stranger.service.heard(lineOf({ agentMentions: [SALES] }))).resolves.toEqual([SALES])

        expect(unroutedIn(refused.cards)).toEqual([{ agentId: SALES, code: "not_tagged" }])
        expect(unroutedIn(stranger.cards)).toEqual([{ agentId: SALES, code: "not_tagged" }])
        expect(stranger.triggers.deliver).not.toHaveBeenCalled()
    })

    it("a router failure hands NO agent to the old path: every agent the message is for is skipped, and the room is told", async () => {
        const { service, agents, triggers, cards } = await build(true)
        agents.find.mockRejectedValue(new TypeError("directory down"))

        await expect(service.heard(lineOf({ agentMentions: [SALES, ACCOUNTING] }))).resolves.toEqual([
            SALES,
            ACCOUNTING,
        ])

        expect(triggers.deliver).not.toHaveBeenCalled()
        expect(unroutedIn(cards)).toEqual([
            { agentId: SALES, code: "route_failed" },
            { agentId: ACCOUNTING, code: "route_failed" },
        ])
    })
})

describe("ChatFallbackService with the node rights switched ON: what is and is not reported", () => {
    it("a duplicate of a turn already started stays taken and is not reported", async () => {
        const { service, triggers, cards } = await build(true)
        triggers.deliver.mockResolvedValue(DELIVERED({ repeats: 1 }))

        await expect(service.heard(lineOf({ agentMentions: [SALES] }))).resolves.toEqual([SALES])

        expect(cards.postMessage).not.toHaveBeenCalled()
    })

    it("an agent named in a reply to a card a person decides on is skipped too", async () => {
        const { service, triggers, cards } = await build(true)

        await expect(service.heard(lineOf({ agentMentions: [SALES], repliedTo: STOP_CARD }))).resolves.toEqual([SALES])

        expect(triggers.deliver).not.toHaveBeenCalled()
        expect(unroutedIn(cards)).toEqual([{ agentId: SALES, code: "outside_turn" }])
    })

    it("another agent named in an agent's private room starts nothing: the room's agent answers, the other is skipped and reported", async () => {
        const { service, triggers, cards } = await build(true)
        const room: PersonLineHeard["room"] = {
            id: "room-direct",
            kind: "direct",
            directKey: `agent:${SALES}|user:${OWNER}`,
        }

        await expect(service.heard(lineOf({ room, agentMentions: [ACCOUNTING] }))).resolves.toEqual([SALES, ACCOUNTING])

        expect(triggers.deliver).toHaveBeenCalledTimes(1)
        expect(triggers.deliver.mock.calls[0]?.[0].agentId).toBe(SALES)
        expect(unroutedIn(cards)).toEqual([{ agentId: ACCOUNTING, code: "outside_turn" }])
    })

    it("one line per message, naming only the turns that did not start", async () => {
        const { service, cards } = await build(true)

        await expect(service.heard(lineOf({ agentMentions: [SALES, MARKETING] }))).resolves.toEqual([SALES, MARKETING])

        expect(cards.postMessage).toHaveBeenCalledTimes(1)
        expect(unroutedIn(cards)).toEqual([{ agentId: MARKETING, code: "no_chat_turn" }])
    })

    it("keeps the old path shut when the line cannot be written, and logs it", async () => {
        const { service, cards, logger } = await build(true)
        const cause = new TypeError("chat down")
        cards.postMessage.mockRejectedValue(cause)

        await expect(service.heard(lineOf({ agentMentions: [MARKETING] }))).resolves.toEqual([MARKETING])

        expect(logger.error).toHaveBeenCalledWith(TeamChatTurnsLogEvent.UnhandledNotPosted, cause, { roomId: GROUP })
    })

    it("a message that names no agent and is for none costs no read of the switch", async () => {
        const { service, switches } = await build(true)

        await expect(service.heard(lineOf())).resolves.toEqual([])

        expect(switches.decides).not.toHaveBeenCalled()
    })
})
