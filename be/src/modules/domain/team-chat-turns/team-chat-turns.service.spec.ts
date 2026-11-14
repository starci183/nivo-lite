import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { LATEST_VERSION } from "@nivo-lite/agent-sdk/graph"
import { latestTemplateVersion } from "@nivo-lite/agent-sdk/template"
import type { TeamChatInput } from "@nivo-lite/agent-sdk/team-chat"
import { ProviderTriggersService, type DeliverInput } from "@modules/domain/provider-triggers"
import { AgentWorkflowsService, bindNode, takingTriggerOf } from "@modules/domain/agent-graphs"
import { AgentDirectoryService, AgentViewScopeService } from "@modules/domain/agents"
import { splitTemplateBindings } from "@modules/domain/graph-nodes/template-run.policy"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { coreTemplates } from "@modules/domain/installed-plugins/installed-plugins.testing"
import type { AgentCard } from "@modules/domain/agents"
import { BrainChangeRequestsService } from "@modules/domain/brain-facts"
import {
    TeamChatCardsService,
    TeamChatRoomsService,
    TeamChatStoreService,
    type HeardReply,
    type PersonLineHeard,
} from "@modules/domain/team-chat"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import type { MemberRow } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { parseJsonText } from "@modules/platform/primitives"
import { factOf } from "@tests/fixtures/builders/brain-facts.builder"
import { messageOf, roomOf } from "@tests/fixtures/builders/team-chat.builder"
import { NAMED_FACT, directRoomViewOf } from "@tests/fixtures/builders/team-chat-turns.builder"
import {
    ACCOUNTING_NAME_VI,
    CALL_OUT_VI,
    CAPTURE_ACTION_VI,
    DELIVERY_SUBJECT_VI,
    DIRECT_SHIP_FEE_ASK_VI,
    FEE_VALUE_VI,
    FEW_ORDERS_ASK_VI,
    GREETING_VI,
    HERE_REPLY_VI,
    KEEP_ORDER_OPEN_VI,
    LUNCH_ASK_VI,
    REPORT_BODY_VI,
    REVENUE_ASK_VI,
    SALES_SHIP_FEE_ASK_VI,
    SHIP_FEE_RULE_30K_VI,
    SHIP_FEE_RULE_35K_VI,
    TWO_AGENTS_ASK_VI,
    UNDELIVERED_ASK_VI,
} from "@tests/fixtures/i18n/team-chat-turns-spec.messages"
import { ChatTurnLimiterService } from "./chat-turn-limiter.service"
import { TeamChatTurnsService } from "./team-chat-turns.service"

const WS = "ws-1"
const OWNER = "u-owner"
const STAFF = "u-lan"
const SALES = "agent-sales"
const ACCOUNTING = "agent-acc"
const MARKETING = "agent-mkt" // an agent of a module that ships no chat turn
const GROUP = "room-common"
const DIRECT = "room-direct-sales"

const CARDS: ReadonlyArray<AgentCard> = [
    { id: SALES, name: "Sales", module: "sales" },
    { id: ACCOUNTING, name: ACCOUNTING_NAME_VI, module: "chatbot" },
    { id: MARKETING, name: "Marketing", module: "marketing" },
]

const PEOPLE: ReadonlyArray<MemberRow> = [
    { id: "seat-owner", user_id: OWNER, display_name: "Anh", role: "owner", status: "active" },
    { id: "seat-lan", user_id: STAFF, display_name: "Lan", role: "staff", status: "active" },
]

const AT = new Date("2026-11-11T10:00:00.000Z")

/** A stored line of the group room, written `minute` minutes after AT. */
const stored = (id: string, authorKind: "user" | "agent", authorId: string, body: string, minute: number) =>
    messageOf({ id, roomId: GROUP, workspaceId: WS, authorKind, authorId, body, createdAt: new Date(AT.getTime() + minute * 60_000) })

const ROOM_LINES = [stored("m-0", "user", OWNER, GREETING_VI, 0), stored("m-1", "agent", SALES, HERE_REPLY_VI, 1)]

/** A person's line as the team chat tells it. */
const lineOf = (over: Partial<PersonLineHeard> & { readonly body?: string } = {}): PersonLineHeard => ({
    workspaceId: WS,
    userId: OWNER,
    room: { id: GROUP, kind: "group", directKey: null },
    message: { id: "m-9", body: over.body ?? SALES_SHIP_FEE_ASK_VI, createdAt: AT.toISOString() },
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
    body: REPORT_BODY_VI,
    createdAt: AT.toISOString(),
})

const build = async () => {
    const workflows = mock<AgentWorkflowsService>()
    const triggers = mock<ProviderTriggersService>()
    const agents = mock<AgentDirectoryService>()
    const members = mock<WorkspaceMembersReadService>()
    const store = mock<TeamChatStoreService>()
    const cards = mock<TeamChatCardsService>()
    const chat = mock<TeamChatRoomsService>()
    const changes = mock<BrainChangeRequestsService>()
    const scopes = mock<AgentViewScopeService>()
    const limiter = mock<ChatTurnLimiterService>()
    scopes.lensOf.mockResolvedValue({ module: "sales", installationId: null })
    limiter.admit.mockReturnValue("run")
    /** The model port of the whole path: a turn reaches it only through a wake, so it counts what a wake would cost. */
    const model = { calls: 0 }
    triggers.deliver.mockImplementation((input) => {
        model.calls += 1
        const eventId = input.events[0]?.event.id ?? ""
        return Promise.resolve({
            status: "delivered",
            events: 1,
            dropped: 0,
            woken: [{ agentId: input.agentId ?? "", workflowId: "w-team-chat", eventId, wakeId: "wake-1" }],
            repeats: 0,
            untaken: 0,
            held: 0,
        })
    })
    agents.find.mockImplementation((_ws, id) => Promise.resolve(CARDS.find((card) => card.id === id) ?? null))
    agents.cardsOf.mockImplementation((_ws, ids) => Promise.resolve(CARDS.filter((card) => ids.includes(card.id))))
    members.directory.mockResolvedValue([...PEOPLE])
    store.threadKeys.mockResolvedValue(ROOM_LINES.map((line) => ({ id: line.id, at: "0" })))
    store.messagesByIds.mockResolvedValue([...ROOM_LINES])
    const moduleRef = await Test.createTestingModule({
        providers: [
            TeamChatTurnsService,
            { provide: ChatTurnLimiterService, useValue: limiter },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: fakeTransaction(mockEntityManager({})).em },
            { provide: ProviderTriggersService, useValue: triggers },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: WorkspaceMembersReadService, useValue: members },
            { provide: TeamChatStoreService, useValue: store },
            { provide: TeamChatCardsService, useValue: cards },
            { provide: TeamChatRoomsService, useValue: chat },
            { provide: BrainChangeRequestsService, useValue: changes },
            { provide: AgentViewScopeService, useValue: scopes },
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: AgentWorkflowsService, useValue: workflows },
        ],
    }).compile()
    const reads = () =>
        store.threadKeys.mock.calls.length +
        store.messagesByIds.mock.calls.length +
        members.directory.mock.calls.length +
        agents.find.mock.calls.length
    return { service: moduleRef.get(TeamChatTurnsService), triggers, store, cards, chat, changes, scopes, limiter, model, reads, workflows }
}

/** A plain object read as a record of unknown values. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === "object" && value !== null

/** The params a started turn carried (the event's data); an empty record when the call carried none. */
const paramsOf = (input: DeliverInput | undefined): Readonly<Record<string, unknown>> => input?.events[0]?.event.data ?? {}

/** The kind a posted agent message carries, read from its JSON text; null when the text is not a JSON object. */
const postedKindOf = (text: string): unknown => {
    const read = parseJsonText(text)
    return read.ok && isRecord(read.value) ? read.value["kind"] : null
}

describe("TeamChatTurnsService: the common-room rule, who answers", () => {
    it("private room: every message is for the room's agent, ONE pinned turn of team-chat with the asker's standing", async () => {
        const { service, triggers } = await build()

        await expect(service.heard(lineOf({ room: DIRECT_ROOM, body: DIRECT_SHIP_FEE_ASK_VI }))).resolves.toEqual([SALES])

        expect(triggers.deliver).toHaveBeenCalledTimes(1)
        const [request] = triggers.deliver.mock.calls[0] ?? []
        expect(request).toMatchObject({
            workspaceId: WS,
            connectionId: null,
            agentId: SALES,
            events: [
                {
                    actorMemberId: "seat-owner",
                    pin: { workflow: "team-chat", version: LATEST_VERSION },
                    event: { id: `chat-turn:m-9:${SALES}` },
                },
            ],
        })
        expect(paramsOf(request)).toMatchObject({
            roomId: DIRECT,
            messageId: "m-9",
            text: DIRECT_SHIP_FEE_ASK_VI,
            room: "direct",
            intent: "answer",
            asker: { name: "Anh", standing: "owner" },
            replyTo: null,
            locale: "vi",
        })
        expect(paramsOf(request)["lines"]).toEqual([
            { id: "m-0", by: "person", name: "Anh", text: GREETING_VI, at: "2026-11-11T10:00:00.000Z" },
            { id: "m-1", by: "agent", name: "Sales", text: HERE_REPLY_VI, at: "2026-11-11T10:01:00.000Z" },
        ])
    })

    it("common room, a message that names nobody: no turn, no read, no model call", async () => {
        const { service, triggers, model, reads } = await build()

        await expect(service.heard(lineOf({ body: LUNCH_ASK_VI }))).resolves.toEqual([])

        expect(triggers.deliver).not.toHaveBeenCalled()
        expect(reads()).toBe(0)
        expect(model.calls).toBe(0)
    })

    it("two agents named: two turns, in the order written, once each", async () => {
        const { service, triggers } = await build()

        await expect(
            service.heard(lineOf({ agentMentions: [ACCOUNTING, SALES, ACCOUNTING], body: TWO_AGENTS_ASK_VI })),
        ).resolves.toEqual([ACCOUNTING, SALES])

        expect(triggers.deliver.mock.calls.map(([request]) => request.agentId)).toEqual([ACCOUNTING, SALES])
    })

    it("a reply to an agent's line (a report card): that agent answers, with the line it replies to", async () => {
        const { service, triggers } = await build()
        const report = agentLine(JSON.stringify({ kind: "report.daily", intent: "report" }), "text")

        await expect(service.heard(lineOf({ body: FEW_ORDERS_ASK_VI, repliedTo: report }))).resolves.toEqual([ACCOUNTING])

        const [request] = triggers.deliver.mock.calls[0] ?? []
        expect(paramsOf(request)["replyTo"]).toMatchObject({ id: "m-card", by: "agent", name: ACCOUNTING_NAME_VI, text: REPORT_BODY_VI })
    })

    it("staff ask with their own standing: the turn carries `staff`, so the answer is read with their rights", async () => {
        const { service, triggers } = await build()

        await service.heard(lineOf({ userId: STAFF, agentMentions: [ACCOUNTING], body: REVENUE_ASK_VI }))

        expect(paramsOf(triggers.deliver.mock.calls[0]?.[0])["asker"]).toEqual({ name: "Lan", standing: "staff" })
    })

    it("an agent is given its chat-turn workflow before the pin is written (N5); a seed that fails never stops the turn", async () => {
        const { service, triggers, workflows } = await build()
        workflows.seedAgent.mockResolvedValueOnce(1).mockRejectedValueOnce(new TypeError("down"))
        await service.heard(lineOf({ room: DIRECT_ROOM }))
        await service.heard(lineOf({ room: DIRECT_ROOM, body: GREETING_VI }))
        expect(workflows.seedAgent.mock.calls).toEqual(Array(2).fill([WS, SALES, "sales", "sales.team-chat"]))
        expect(triggers.deliver).toHaveBeenCalledTimes(2)
    })
})

describe("TeamChatTurnsService: the common-room rule, who never answers", () => {
    it("a reply to a card a person decides on (stop, truth change, approval) is that card's door: no chat turn", async () => {
        const { service, triggers } = await build()

        for (const card of [
            agentLine(JSON.stringify({ kind: "workflow.stopped" })),
            agentLine(JSON.stringify({ kind: "brain.change" })),
            agentLine(null, "approval"),
        ])
            await expect(service.heard(lineOf({ body: KEEP_ORDER_OPEN_VI, repliedTo: card }))).resolves.toEqual([])

        expect(triggers.deliver).not.toHaveBeenCalled()
    })

    it("an agent's own line, a reply to a person, or a message with no words starts no turn: agents never answer agents", async () => {
        const { service, triggers, model } = await build()
        const person: HeardReply = { ...agentLine(null), authorKind: "user", authorId: STAFF }

        await expect(service.heard(lineOf({ body: "ok", repliedTo: person }))).resolves.toEqual([])
        await expect(service.heard(lineOf({ body: "  ", agentMentions: [SALES] }))).resolves.toEqual([])

        expect(triggers.deliver).not.toHaveBeenCalled()
        expect(model.calls).toBe(0)
    })

    it("an agent whose module ships no chat turn keeps the old tag path: the router takes nothing", async () => {
        const { service, triggers } = await build()

        await expect(service.heard(lineOf({ agentMentions: [MARKETING] }))).resolves.toEqual([])

        expect(triggers.deliver).not.toHaveBeenCalled()
    })

    it("rate limit per room: over the limit the agent says ONE line, then stays quiet for the window", async () => {
        const { service, triggers, cards, limiter } = await build()
        limiter.admit.mockReturnValueOnce("run").mockReturnValueOnce("run").mockReturnValueOnce("pause_notice").mockReturnValueOnce("quiet")
        const say = (id: string) => service.heard({ ...lineOf({ agentMentions: [SALES] }), message: { id, body: "@Sales ?", createdAt: AT.toISOString() } })

        await say("m-a")
        await say("m-b")
        await expect(say("m-c")).resolves.toEqual([SALES])
        await expect(say("m-d")).resolves.toEqual([SALES])

        expect(limiter.admit.mock.calls.map(([roomKey]) => roomKey)).toEqual([`${WS}:${GROUP}`, `${WS}:${GROUP}`, `${WS}:${GROUP}`, `${WS}:${GROUP}`])
        expect(triggers.deliver).toHaveBeenCalledTimes(2)
        expect(cards.postMessage).toHaveBeenCalledTimes(1)
        expect(cards.postMessage.mock.calls[0]?.[1]).toMatchObject({ authorAgentId: SALES, roomId: GROUP, key: "chat-pause:m-c" })
        expect(postedKindOf(String(cards.postMessage.mock.calls[0]?.[1].agentMessage))).toBe("message.text")

        await say("m-e")
        expect(triggers.deliver).toHaveBeenCalledTimes(3)
    })

    it("a customer's conversation is never a chat turn: no channel or system wake can route to the team-chat workflow", () => {
        const chatTurns = coreTemplates().filter((template) => template.id.endsWith(".team-chat"))
        expect(chatTurns.map((template) => template.id).sort((a, b) => a.localeCompare(b))).toEqual(["chatbot.team-chat", "sales.team-chat"])
        for (const template of chatTurns) {
            const graph = latestTemplateVersion(template).graph
            for (const source of ["channel", "system-event", "chats-group", "schedule"])
                expect(takingTriggerOf(graph, source, { conversationId: "c1", channel: "zalo", text: "hi" })).toBeNull()
            expect(template.primary).toBe(false)
        }
    })
})

/** A team.chat input checked against the node's schema: the parsed input, or the schema's issues. */
interface ParsedChatInput {
    /** The schema's error when the input failed. */
    readonly error?: { readonly issues: unknown } | undefined
    /** The parsed input when it passed. */
    readonly data?: TeamChatInput | undefined
}

/** A parsed value read as a team.chat input: an object that carries the asked message. */
const isChatInput = (value: unknown): value is TeamChatInput => isRecord(value) && typeof value["messageId"] === "string"

// `team.chat` is a template node since the flip: the registry holds no definition of it, the node host splits what the binder gives.
const chatNode = INSTALLED.templateNodeOf("team.chat") ?? undefined
const template = INSTALLED.templateOf("sales.team-chat") ?? undefined

/**
 * What the step is given for the turn the router started: the delivered event's data (kept as JSON text on the wake and read again) -> the
 * generic trigger scope the engine builds (`eventId`, `data`) -> template bindings -> binder.
 */
const stepInputOf = (request: DeliverInput | undefined): Readonly<Record<string, unknown>> => {
    expect(request).toBeDefined()
    const event = request?.events[0]?.event
    if (event === undefined) return {}
    const read = parseJsonText(JSON.stringify(event.data))
    const trigger = { eventId: event.id, data: read.ok && isRecord(read.value) ? read.value : {} }
    const graph = template === undefined ? undefined : latestTemplateVersion(template).graph
    const node = graph?.nodes.find((one) => one.step === "team.chat")
    expect(node).toBeDefined()
    if (node === undefined) return {}
    expect(chatNode).toBeDefined()
    if (chatNode === undefined) return {}
    const bound = bindNode(undefined, node, { trigger, steps: {}, namespace: "sales.team-chat", memory: null })
    return splitTemplateBindings(chatNode, bound.params, bound.input).input
}

const startedInput = async (line: PersonLineHeard): Promise<Readonly<Record<string, unknown>>> => {
    const { service, triggers } = await build()
    await service.heard(line)
    const [request] = triggers.deliver.mock.calls[0] ?? []
    return stepInputOf(request)
}

const parsed = (given: Readonly<Record<string, unknown>>): ParsedChatInput => {
    expect(chatNode).toBeDefined()
    if (chatNode === undefined) return {}
    const result = chatNode.input.safeParse(given)
    if (!result.success) return { error: result.error }
    return isChatInput(result.data) ? { data: result.data } : {}
}

/**
 * D-P11-3: the input the `team.chat` step RECEIVES, from the router's real output, through the real path a wake takes (the tag door's
 * context, stored as JSON, the trigger scope, the template's own bindings, the binder, and since the flip the node host's split of a
 * template node's bindings by its schemas) into the REAL node input schema. A hand-built
 * input hid that the binder leaves out a ref that finds null, so a message replying to nothing lost its `replyTo` key.
 */
describe("TeamChatTurnsService: the router's real output is a valid team.chat input", () => {
    it("a private-room message that replies to nothing: the key arrives absent and the node takes it as null", async () => {
        const given = await startedInput(lineOf({ room: DIRECT_ROOM, body: SHIP_FEE_RULE_35K_VI }))

        expect("replyTo" in given).toBe(false)
        const result = parsed(given)
        expect(result.error?.issues).toBeUndefined()
        expect(result.data).toMatchObject({
            room: "direct",
            intent: "answer",
            text: SHIP_FEE_RULE_35K_VI,
            asker: { name: "Anh", standing: "owner" },
            replyTo: null,
            locale: "vi",
        })
    })

    it("a common-room @mention by staff, with the room's lines: valid, standing and lines kept", async () => {
        const given = await startedInput(lineOf({ userId: STAFF, agentMentions: [SALES], body: UNDELIVERED_ASK_VI }))

        const result = parsed(given)
        expect(result.error?.issues).toBeUndefined()
        expect(result.data).toMatchObject({ room: "common", asker: { name: "Lan", standing: "staff" }, replyTo: null })
        expect(result.data?.lines).toHaveLength(2)
    })

    it("a reply to an agent line: valid, the line replied to kept", async () => {
        const report = agentLine(JSON.stringify({ kind: "report.daily", intent: "report" }), "text")
        const given = await startedInput(lineOf({ body: FEW_ORDERS_ASK_VI, repliedTo: report }))

        const result = parsed(given)
        expect(result.error?.issues).toBeUndefined()
        expect(result.data?.replyTo).toMatchObject({ id: "m-card", by: "agent", name: ACCOUNTING_NAME_VI })
    })

    it("an empty room (no line before the message): `lines` arrives as an empty list, valid", async () => {
        const { service, triggers, store } = await build()
        store.threadKeys.mockResolvedValue([])
        store.messagesByIds.mockResolvedValue([])
        await service.heard(lineOf({ room: DIRECT_ROOM, body: CALL_OUT_VI }))
        const [request] = triggers.deliver.mock.calls[0] ?? []

        const result = parsed(stepInputOf(request))
        expect(result.error?.issues).toBeUndefined()
        expect(result.data).toMatchObject({ lines: [], replyTo: null })
    })
})

describe("TeamChatTurnsService: capture into the Second Brain", () => {
    const message = stored("m-rule", "user", OWNER, SHIP_FEE_RULE_30K_VI, 3)
    const room = roomOf({ id: DIRECT, kind: "direct", directKey: `agent:${SALES}|user:${OWNER}` })

    const ready = async () => {
        const world = await build()
        world.store.messagesByIds.mockResolvedValue([{ ...message, roomId: DIRECT }])
        world.store.roomById.mockResolvedValue(room)
        world.chat.room.mockResolvedValue(directRoomViewOf(DIRECT, OWNER, AT))
        return world
    }

    it("the owner names the truth: filed at once through the change requests, the quoted line as evidence, a reason, no AI", async () => {
        const { service, changes, triggers, model } = await ready()
        changes.propose.mockResolvedValue({ outcome: "filed", fact: factOf() })

        await expect(service.capture(WS, OWNER, { messageId: "m-rule", agentId: null, fact: NAMED_FACT })).resolves.toBe("filed")

        expect(changes.propose).toHaveBeenCalledWith(WS, expect.objectContaining({
            subjectLabel: DELIVERY_SUBJECT_VI,
            value: FEE_VALUE_VI,
            room: "direct",
            messageId: "m-rule",
            quote: SHIP_FEE_RULE_30K_VI,
            proposedBy: "sales",
            agentId: SALES,
            installationId: null,
        }))
        const [, filed] = changes.propose.mock.calls[0] ?? []
        expect(filed?.reason).toContain(CAPTURE_ACTION_VI)
        expect(triggers.deliver).not.toHaveBeenCalled()
        expect(model.calls).toBe(0)
    })

    it("reads the members the form left out (value, unit, dates) as null, and files the truth all the same", async () => {
        const { service, changes } = await ready()
        changes.propose.mockResolvedValue({ outcome: "filed", fact: factOf() })

        await expect(
            service.capture(WS, OWNER, { messageId: "m-rule", fact: { subjectLabel: "S", attributeLabel: "A" } }),
        ).resolves.toBe("filed")

        expect(changes.propose).toHaveBeenCalledWith(
            WS,
            expect.objectContaining({ subjectLabel: "S", attributeLabel: "A", value: null, unit: null, validFrom: null, validTo: null }),
        )
    })

    it("FX6: the agent's instance only finds a value kept for it; the change requests file a new truth workspace-wide", async () => {
        const { service, changes, scopes } = await ready()
        scopes.lensOf.mockResolvedValue({ module: "sales", installationId: "inst-sales" })
        changes.propose.mockResolvedValue({ outcome: "filed", fact: factOf() })

        await service.capture(WS, OWNER, { messageId: "m-rule", agentId: null, fact: NAMED_FACT })

        expect(scopes.lensOf).toHaveBeenCalledWith(WS, SALES)
        expect(changes.propose).toHaveBeenCalledWith(WS, expect.objectContaining({ agentId: SALES, installationId: "inst-sales" }))
    })

    it("without the truth named, the agent drafts it in a capture turn; staff may not press it", async () => {
        const { service, triggers } = await ready()

        await expect(service.capture(WS, OWNER, { messageId: "m-rule", agentId: null, fact: null })).resolves.toBe("drafting")
        expect(paramsOf(triggers.deliver.mock.calls[0]?.[0])).toMatchObject({ intent: "capture", messageId: "m-rule" })
        expect(triggers.deliver.mock.calls[0]?.[0].events[0]?.event.id).toBe(`chat-capture:m-rule:${SALES}`)

        await expect(service.capture(WS, STAFF, { messageId: "m-rule", agentId: null, fact: null })).resolves.toBe("not_allowed")
        expect(triggers.deliver).toHaveBeenCalledTimes(1)
    })
})

describe("TeamChatTurnsService: the founder's NIVO room", () => {
    it("the founder's NIVO room (no agent in its pair): a message or a reply to NIVO's card wakes nobody and never fails", async () => {
        const { service, triggers, model, reads } = await build()
        const nivoRoom = { id: "room-nivo", kind: "direct" as const, directKey: `system:nivo|user:${OWNER}` }
        const nivoCard: HeardReply = {
            id: "m-nivo",
            authorKind: "system",
            authorId: null,
            kind: "system",
            agentMessage: '{"kind":"background.stopped","payload":{}}',
            body: "brain.policies.derive · model",
            createdAt: AT.toISOString(),
        }

        await expect(service.heard(lineOf({ room: nivoRoom, body: "please retry it" }))).resolves.toEqual([])
        await expect(service.heard(lineOf({ room: nivoRoom, body: "ok", repliedTo: nivoCard }))).resolves.toEqual([])

        expect(triggers.deliver).not.toHaveBeenCalled()
        expect(reads()).toBe(0)
        expect(model.calls).toBe(0)
    })
})
