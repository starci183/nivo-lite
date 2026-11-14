import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { EffectCall } from "@nivo-lite/agent-sdk/node"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { defineAgentMessageKind, type AgentMessageKind } from "@nivo-lite/agent-sdk/team-chat"
import { z } from "zod"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeEffectExecutor, NodeTurn } from "@modules/domain/graph-nodes"
import { ERROR_REPORTER, type ErrorReporter } from "@modules/platform/errors"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { parseJsonText } from "@modules/platform/primitives"
import { messageOf as storedMessageOf } from "@tests/fixtures/builders/team-chat.builder"
import { AgentMessagePostExecutorService } from "./agent-message-post-executor.service"
import { TEAM_CARD_KINDS } from "./team-chat.decorators"
import { lineKeyOf } from "./team-chat.policy"
import { TeamChatErrorCode } from "./errors/team-chat.error"
import { TeamChatAudienceService } from "./team-chat-audience.service"
import { TeamChatCardsService } from "./team-chat-cards.service"
import { TeamChatStoreService } from "./team-chat-store.service"
import type { ChatRoomMessageEntity } from "./persistence/entities"

const TURN: NodeTurn = {
    turnId: "turn-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    subject: null,
    conversationId: null,
    locale: "en",
}
const CALL: EffectCall = { key: "run-1:0", dedupeKey: "order-notice:o1" }
const TEXT = { kind: "message.text", intent: "notify", title: "Complaint", text: "A customer is unhappy with DH-1" }

/** A kind a package registers, as the fixture installation lists it: the engine knows only its id and the schema of its payload. */
const TCORE_CARD: AgentMessageKind = defineAgentMessageKind({
    id: "tcore.card",
    payload: z.object({ no: z.string(), total: z.number() }),
    actions: { approve: false, edit: "none", reject: false },
})

const TEAM_CARD = {
    kind: "tcore.card",
    intent: "notify",
    title: "Card 7",
    summary: "Card 7 · 12",
    payload: { no: "7", total: 12 },
    work: { label: "card", href: "/cards/7" },
}

const POSTED_FACTS = { requested: "own", audience: "own", purpose: "module", roomName: "Sales", roomId: "room-sales" }

const build = async (
    lines: ReadonlyArray<ChatRoomMessageEntity> = [],
) => {
    const store = mock<TeamChatStoreService>({
        messagesByIds: jest.fn((_ws: string, ids: ReadonlyArray<string>) =>
            Promise.resolve(lines.filter((line) => ids.includes(line.id))),
        ),
    })
    const cards = mock<TeamChatCardsService>({
        postMessage: jest.fn().mockResolvedValue({ roomId: "room-1", messageId: "answer-1" }),
    })
    const chat = mock<TeamChatAudienceService>({
        postTeamCard: jest.fn().mockResolvedValue({ messageId: "msg-1", facts: POSTED_FACTS }),
    })
    const added: Array<NodeEffectExecutor> = []
    const registry = mock<GraphNodeRegistryService>({
        addExecutor: jest.fn((executor: NodeEffectExecutor) => void added.push(executor)),
    })
    const errors = mock<ErrorReporter>({ report: jest.fn().mockResolvedValue(undefined) })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentMessagePostExecutorService,
            { provide: TeamChatAudienceService, useValue: chat },
            { provide: TeamChatStoreService, useValue: store },
            { provide: TeamChatCardsService, useValue: cards },
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: TEAM_CARD_KINDS, useValue: (id: string) => (id === TCORE_CARD.id ? TCORE_CARD : null) },
            { provide: ERROR_REPORTER, useValue: errors },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    moduleRef.get(AgentMessagePostExecutorService).onModuleInit()
    const postOf = () => chat.postTeamCard.mock.calls[0]?.[1]
    const messageOf = (): unknown => postOf()?.message
    return { chat, cards, registry, executor: added[0], messageOf, postOf, errors, logger }
}

describe("AgentMessagePostExecutorService", () => {
    it("registers itself for the team message post tool", async () => {
        expect((await build()).executor?.effect).toBe(TOOL.teamMessagePost)
    })

    it("stores a finished card of a registered kind as the package built it, without reading any record", async () => {
        const { chat, executor, messageOf, postOf, registry } = await build()

        await expect(executor?.execute(TURN, TEAM_CARD, CALL)).resolves.toEqual({
            kind: "chat-message",
            id: "msg-1",
            facts: { messageId: "msg-1", ...POSTED_FACTS },
        })
        expect(chat.postTeamCard).toHaveBeenCalledWith("ws-1", expect.objectContaining({ agentId: "agent-1" }))
        expect(postOf()).toMatchObject({ audience: "own", key: "agent-message:order-notice:o1" })
        expect(messageOf()).toEqual({
            kind: "tcore.card",
            intent: "notify",
            title: "Card 7",
            summary: "Card 7 · 12",
            payload: { no: "7", total: 12 },
            work: { label: "card", href: "/cards/7" },
        })
        expect(registry.portOf).not.toHaveBeenCalled()
    })

    it("R45: a refused or failed team post is never silent: one app error and one log line, nothing posted about it, the same answer", async () => {
        const { chat, executor, errors, logger } = await build()
        await expect(executor?.execute(TURN, { ...TEAM_CARD, kind: "tcore.unknown" }, CALL)).resolves.toMatchObject({ kind: "refused" })
        expect(errors.report).toHaveBeenCalledWith(
            "team_chat.post_refused",
            expect.objectContaining({ code: TeamChatErrorCode.AgentMessageNotPosted }),
            { workspaceId: "ws-1", agentId: "agent-1", runId: "turn-1", code: "kind_not_postable", key: "run-1:0" },
        )
        expect(logger.warn).toHaveBeenCalledWith("team_chat.post_refused", expect.objectContaining({ code: "kind_not_postable" }))

        const down = new Error("db down")
        chat.postTeamCard.mockRejectedValueOnce(down)
        await expect(executor?.execute(TURN, TEAM_CARD, CALL)).rejects.toBe(down)
        expect(errors.report).toHaveBeenLastCalledWith("team_chat.post_refused", down, expect.objectContaining({ code: "Error" }))
        // No recursion: the failure is told to the console, never posted to the team chat again.
        expect(chat.postTeamCard).toHaveBeenCalledTimes(1)
    })

    it("records nothing for a post that went through", async () => {
        const { executor, errors } = await build()
        await executor?.execute(TURN, TEAM_CARD, CALL)
        expect(errors.report).not.toHaveBeenCalled()
    })

    it("posts the card to the audience it names", async () => {
        const { executor, postOf } = await build()
        await executor?.execute(TURN, { ...TEAM_CARD, audience: "everyone" }, CALL)
        expect(postOf()).toMatchObject({ audience: "everyone" })
    })

    it("answers a kind no plugin registers, and content that is not of its kind's shape, as refusal facts and posts nothing", async () => {
        const { chat, executor } = await build()
        await expect(executor?.execute(TURN, { ...TEAM_CARD, kind: "tcore.unknown" }, CALL)).resolves.toEqual({
            kind: "refused",
            id: "kind_not_postable",
            facts: {},
        })
        await expect(executor?.execute(TURN, { ...TEAM_CARD, payload: { no: 7 } }, CALL)).resolves.toEqual({
            kind: "refused",
            id: "card_invalid",
            facts: {},
        })
        expect(chat.postTeamCard).not.toHaveBeenCalled()
    })

    it("refuses a card of an engine kind that has no tool path (a stop card, a core table of rows) as an unregistered kind", async () => {
        const { chat, executor } = await build()
        await expect(executor?.execute(TURN, { ...TEAM_CARD, kind: "records.rows" }, CALL)).resolves.toMatchObject({ id: "kind_not_postable" })
        expect(chat.postTeamCard).not.toHaveBeenCalled()
    })

    it("no longer builds a card from an order id: the old payload is not a post", async () => {
        const { chat, executor } = await build()
        await expect(executor?.execute(TURN, { kind: "order.summary", orderId: "o1" }, CALL)).rejects.toMatchObject({
            code: TeamChatErrorCode.InvalidAgentMessage,
        })
        expect(chat.postTeamCard).not.toHaveBeenCalled()
    })
})

describe("AgentMessagePostExecutorService words and audience", () => {
    it("says plain words as the agent, with the words as the line and the content", async () => {
        const { executor, messageOf, postOf } = await build()
        await executor?.execute(TURN, TEXT, { key: "run-1:0", dedupeKey: null })
        expect(postOf()).toMatchObject({ key: "agent-message:run-1:0" })
        expect(messageOf()).toEqual({
            kind: "message.text",
            intent: "notify",
            title: "Complaint",
            summary: TEXT.text,
            payload: { text: TEXT.text },
        })
    })

    it("passes the audience asked, its own team by default, and answers the room the chat used as the facts", async () => {
        const { chat, executor } = await build()
        await executor?.execute(TURN, TEXT, CALL)
        await executor?.execute(TURN, { ...TEXT, audience: "everyone" }, CALL)
        await executor?.execute(TURN, { ...TEXT, audience: "founder" }, CALL)
        expect(chat.postTeamCard.mock.calls.map((call) => call[1].audience)).toEqual(["own", "everyone", "founder"])
    })

    it("keeps a call key too long for the room line as a digest, the same for the same call, within the bound", async () => {
        const { executor, chat } = await build()
        const dedupeKey = "payment-notice:5f0c1a2e-9d4b-4c7e-8a1f-3b2d6e7f8a90"
        await executor?.execute(TURN, TEXT, { key: "run-1:0", dedupeKey })
        await executor?.execute(TURN, TEXT, { key: "run-2:0", dedupeKey })
        const [first, second] = chat.postTeamCard.mock.calls.map((call) => call[1].key)
        expect(first).toMatch(/^agent-message:[0-9a-f]{48}$/)
        expect(first?.length).toBeLessThanOrEqual(64)
        expect(second).toBe(first)
    })

    it("refuses a payload of the wrong shape and posts nothing", async () => {
        const { chat, executor } = await build()
        await expect(executor?.execute(TURN, { ...TEXT, intent: "shout" }, CALL)).rejects.toMatchObject({
            code: TeamChatErrorCode.InvalidAgentMessage,
        })
        expect(chat.postTeamCard).not.toHaveBeenCalled()
    })
})

/** The card of a stopped workflow: the AI's words, one fact and two suggestions. */
const CARD = {
    workflow: { moduleKey: "accounting", key: "reconcile", title: "reconcile" },
    step: { key: "settle", nodeId: "payment.settle", title: "settle" },
    runId: "run-1",
    leadId: "lead-1",
    conversationId: "c-1",
    by: "ai",
    reason: "Khach chuyen du",
    question: "Nhan khong?",
    facts: [{ name: "differenceVnd", value: "1000" }],
    suggestions: [
        { text: "Nhan va ghi so", handledBy: "workflow" },
        { text: "Hoan lai khach", handledBy: "person" },
    ],
    decisions: [],
    repeats: 1,
    firstAt: "2026-11-10T08:00:00.000Z",
    lastAt: "2026-11-10T08:00:00.000Z",
}
const STOPPED = { kind: "workflow.stopped", title: "Dung", summary: "Khach chuyen du", card: CARD }
const STOP_CALL: EffectCall = { key: "run-stuck:run-1:settle:0:1", dedupeKey: "run-stuck:run-1:settle" }

describe("AgentMessagePostExecutorService the card of a stopped workflow: post and fold", () => {
    it("posts the common card as an ask whose options are the suggestions, once under the key of the stuck step", async () => {
        const { chat, executor, postOf } = await build()
        chat.storedCard.mockResolvedValue(null)

        await executor?.execute(TURN, STOPPED, STOP_CALL)

        expect(chat.foldTeamCard).not.toHaveBeenCalled()
        expect(postOf()).toMatchObject({
            agentId: "agent-1",
            audience: "own",
            key: "agent-message:run-stuck:run-1:settle",
        })
        expect(postOf()?.message).toMatchObject({
            kind: "workflow.stopped",
            intent: "ask",
            title: "Dung",
            summary: "Khach chuyen du",
            payload: CARD,
            options: [
                { id: "0", label: "Nhan va ghi so" },
                { id: "1", label: "Hoan lai khach" },
            ],
            occurrence: STOP_CALL.key,
        })
    })

    it("carries the approval card of a permission request on the stop card, and keeps a package preview only when its kind accepts it", async () => {
        const { chat, executor, postOf } = await build()
        chat.storedCard.mockResolvedValue(null)
        const decision = {
            step: { nodeId: "payment.refund", title: "Hoan tien", description: "Hoan tien cho khach" },
            call: { tool: "nivo.tool.payment.refund.create", account: "conn-mb" },
            facts: [{ name: "So tien", value: "120.000 d" }],
            text: "Agent xin hoan 120.000 d cho khach",
            preview: { kind: "tcore.card", payload: { no: "7", total: 12 } },
        }
        const wrongPreview = { kind: "tcore.card", payload: { no: 7 } }

        await executor?.execute(
            TURN,
            { ...STOPPED, card: { ...CARD, preview: wrongPreview }, decision },
            STOP_CALL,
        )

        // The decision is stored with the stop (its valid preview kept); the stop's own preview failed its kind's schema and was dropped.
        expect(postOf()?.message).toMatchObject({ kind: "workflow.stopped", payload: { ...CARD, decision } })
        expect(postOf()?.message).not.toHaveProperty("payload.preview")
    })

    it("drops the approval card's preview of a kind no package registered, and still posts the card", async () => {
        const { chat, executor, postOf } = await build()
        chat.storedCard.mockResolvedValue(null)
        const decision = {
            step: { nodeId: "n", title: "t", description: "d" },
            call: { tool: "nivo.tool.x.create", account: null },
            facts: [],
            text: "brief",
            preview: { kind: "ghost.card", payload: {} },
        }

        await executor?.execute(TURN, { ...STOPPED, decision }, STOP_CALL)

        const { preview: _dropped, ...kept } = decision
        expect(postOf()?.message).toMatchObject({ payload: { ...CARD, decision: kept } })
        expect(postOf()?.message).not.toHaveProperty("payload.decision.preview")
    })

    it("folds the same step stopping again into the card already there: one more repeat, the first time kept, the later time and the new words", async () => {
        const { chat, executor } = await build()
        chat.storedCard.mockResolvedValue({
            kind: "workflow.stopped",
            intent: "ask",
            title: "Dung",
            summary: "old",
            payload: { ...CARD, reason: "old" },
            occurrence: "run-stuck:run-1:settle:0:1",
        })
        chat.foldTeamCard.mockResolvedValue("msg-9")
        const later = { ...CARD, lastAt: "2026-11-10T09:00:00.000Z", firstAt: "2026-11-10T09:00:00.000Z" }

        const fact = await executor?.execute(
            TURN,
            { ...STOPPED, card: later },
            { key: "run-stuck:run-1:settle:1:1", dedupeKey: STOP_CALL.dedupeKey },
        )

        expect(chat.postTeamCard).not.toHaveBeenCalled()
        expect(fact).toMatchObject({ id: "msg-9" })
        const [workspace, key, message] = chat.foldTeamCard.mock.calls[0] ?? []
        expect(workspace).toBe("ws-1")
        // The key of the first card: the reply of a founder to the folded card still names it, which resumes the step.
        expect(key).toBe(lineKeyOf("run-stuck:run-1:settle"))
        expect(message?.payload).toMatchObject({
            repeats: 2,
            firstAt: CARD.firstAt,
            lastAt: later.lastAt,
            reason: CARD.reason,
        })
    })

    it("folds nothing twice for a replay of the same stop", async () => {
        const { chat, executor } = await build()
        chat.storedCard.mockResolvedValue({
            kind: "workflow.stopped",
            intent: "ask",
            title: "Dung",
            summary: "x",
            payload: { ...CARD, repeats: 3 },
            occurrence: STOP_CALL.key,
        })
        chat.foldTeamCard.mockResolvedValue("msg-9")

        await executor?.execute(TURN, STOPPED, STOP_CALL)

        expect(chat.foldTeamCard.mock.calls[0]?.[2].payload).toMatchObject({ repeats: 3 })
    })
})

describe("AgentMessagePostExecutorService the card of a stopped workflow: engine words", () => {
    it("keeps the AI's words and adds the freeze decisions when the engine tells the same stop again: one message for one stop", async () => {
        const { chat, executor } = await build()
        chat.storedCard.mockResolvedValue({
            kind: "workflow.stopped",
            intent: "ask",
            title: "Dung",
            summary: "Khach chuyen du",
            payload: CARD,
            occurrence: STOP_CALL.key,
        })
        chat.foldTeamCard.mockResolvedValue("msg-9")
        const engine = {
            ...CARD,
            by: "engine",
            reason: "Quy trinh dung",
            question: null,
            suggestions: [],
            decisions: ["retry", "take_over", "skip"],
        }

        await executor?.execute(
            TURN,
            { kind: "workflow.stopped", title: "Loi", summary: "Quy trinh dung", card: engine },
            STOP_CALL,
        )

        expect(chat.postTeamCard).not.toHaveBeenCalled()
        const message = chat.foldTeamCard.mock.calls[0]?.[2]
        expect(message).toMatchObject({ title: "Dung", summary: "Khach chuyen du" })
        expect(message?.payload).toEqual({ ...CARD, decisions: ["retry", "take_over", "skip"] })
    })
})

describe("AgentMessagePostExecutorService the card of a stopped workflow: resolution and refusal", () => {
    it("rewrites a stop whose run then ended well in place, as resolved and asking nothing, and posts nothing when there was no card", async () => {
        const { chat, executor } = await build()
        const RESOLVED = {
            kind: "workflow.stopped",
            resolved: { title: "Quy trinh da chay tiep", summary: "Xong", at: "2026-11-10T10:00:00.000Z" },
        }
        const RESOLVE_CALL: EffectCall = { key: "run-stuck:run-1:settle:resolved", dedupeKey: STOP_CALL.dedupeKey }
        chat.storedCard.mockResolvedValue({
            kind: "workflow.stopped",
            intent: "ask",
            title: "Dung",
            summary: "Khach chuyen du",
            payload: CARD,
            occurrence: STOP_CALL.key,
        })
        chat.foldTeamCard.mockResolvedValue("msg-9")

        await expect(executor?.execute(TURN, RESOLVED, RESOLVE_CALL)).resolves.toMatchObject({
            id: "msg-9",
            facts: { resolved: true },
        })

        expect(chat.postTeamCard).not.toHaveBeenCalled()
        const [, key, message] = chat.foldTeamCard.mock.calls[0] ?? []
        expect(key).toBe(lineKeyOf("run-stuck:run-1:settle"))
        expect(message).toMatchObject({
            intent: "notify",
            title: "Quy trinh da chay tiep",
            summary: "Xong",
            options: [],
        })
        expect(message?.payload).toEqual({
            ...CARD,
            suggestions: [],
            decisions: [],
            resolvedAt: "2026-11-10T10:00:00.000Z",
        })

        chat.storedCard.mockResolvedValue(null)
        chat.foldTeamCard.mockClear()
        await expect(executor?.execute(TURN, RESOLVED, RESOLVE_CALL)).resolves.toMatchObject({
            facts: { resolved: false },
        })
        expect(chat.foldTeamCard).not.toHaveBeenCalled()
        expect(chat.postTeamCard).not.toHaveBeenCalled()
    })

    it("refuses a card whose content does not fit the kind, and posts nothing", async () => {
        const { chat, executor } = await build()
        await expect(
            executor?.execute(TURN, { ...STOPPED, card: { ...CARD, by: "model" } }, STOP_CALL),
        ).rejects.toMatchObject({ code: TeamChatErrorCode.InvalidAgentMessage })
        expect(chat.postTeamCard).not.toHaveBeenCalled()
    })
})

describe("AgentMessagePostExecutorService the answer of a team chat turn (chat.answer)", () => {
    const ROOM_TURN: NodeTurn = { ...TURN, subject: { kind: "chat-room", id: "room-1" } }
    const ASKED = storedMessageOf({ id: "m-1", roomId: "room-1", authorKind: "user", authorId: "u-1" })
    const ANSWER = { kind: "chat.answer", messageId: "m-1", text: "Phi ship noi thanh la 20.000 d." }
    const ANSWER_CALL: EffectCall = { key: "run-9:0", dedupeKey: "chat-answer:m-1:agent-1" }

    it("posts once in the asked room as a reply to the person's line, a typed message.text", async () => {
        const { cards, chat, executor } = await build([ASKED])

        await expect(executor?.execute(ROOM_TURN, ANSWER, ANSWER_CALL)).resolves.toEqual({
            kind: "chat-message",
            id: "answer-1",
            facts: { messageId: "answer-1", roomId: "room-1", replyTo: "m-1" },
        })
        expect(cards.postMessage).toHaveBeenCalledTimes(1)
        const [workspaceId, line] = cards.postMessage.mock.calls[0] ?? []
        expect(workspaceId).toBe("ws-1")
        expect(line).toMatchObject({
            authorAgentId: "agent-1",
            roomId: "room-1",
            toUserId: null,
            body: ANSWER.text,
            key: lineKeyOf("chat-answer:m-1:agent-1"),
            replyTo: "m-1",
        })
        expect(parseJsonText(line?.agentMessage ?? "null")).toMatchObject({ ok: true, value: { kind: "message.text", intent: "notify" } })
        expect(chat.postTeamCard).not.toHaveBeenCalled()
    })

    it("answers the same dedupe key with the same line key (the store keeps one line)", async () => {
        const { cards, executor } = await build([ASKED])
        await executor?.execute(ROOM_TURN, ANSWER, ANSWER_CALL)
        await executor?.execute(ROOM_TURN, ANSWER, ANSWER_CALL)
        const keys = cards.postMessage.mock.calls.map((call) => call[1].key)
        expect(new Set(keys).size).toBe(1)
    })

    it("refuses another room or an agent's line, and posts nothing", async () => {
        const other = await build([ASKED])
        await expect(
            other.executor?.execute({ ...TURN, subject: { kind: "chat-room", id: "room-2" } }, ANSWER, ANSWER_CALL),
        ).resolves.toMatchObject({ id: "other_room" })
        expect(other.cards.postMessage).not.toHaveBeenCalled()

        const agentLine = await build([{ ...ASKED, authorKind: "agent" }])
        await expect(agentLine.executor?.execute(ROOM_TURN, ANSWER, ANSWER_CALL)).resolves.toMatchObject({
            id: "not_person_line",
        })
        expect(agentLine.cards.postMessage).not.toHaveBeenCalled()
    })
})
