import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { EffectCall } from "@nivo-lite/agent-sdk/node"
import { TOOL } from "@nivo-lite/blocks-core"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeDataPort, NodeEffectExecutor, NodeRow, NodeTurn } from "@modules/domain/graph-nodes"
import { AgentMessagePostExecutorService } from "./agent-message-post-executor.service"
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

const ORDER: NodeRow = {
    orderNo: "DH-1",
    amountVnd: 2000,
    items: { lines: [{ name: "Small basket", qty: 1, unitVnd: 2000, amountVnd: 2000 }] },
    note: "25 Nguyen Hue",
    leadId: "l1",
}

const POSTED_FACTS = { requested: "own", audience: "own", purpose: "module", roomName: "Sales", roomId: "room-sales" }

const build = async (
    rows: Readonly<Record<string, ReadonlyArray<NodeRow>>> = {},
    lines: ReadonlyArray<Partial<ChatRoomMessageEntity>> = [],
) => {
    const store = mock<TeamChatStoreService>({
        messagesByIds: jest.fn((_ws: string, ids: ReadonlyArray<string>) =>
            Promise.resolve(lines.filter((line) => ids.includes(line.id ?? "")) as Array<ChatRoomMessageEntity>),
        ),
    })
    const cards = mock<TeamChatCardsService>({
        postMessage: jest.fn().mockResolvedValue({ roomId: "room-1", messageId: "answer-1" }),
    })
    const chat = mock<TeamChatAudienceService>({
        postTeamCard: jest.fn().mockResolvedValue({ messageId: "msg-1", facts: POSTED_FACTS }),
    })
    const added: Array<NodeEffectExecutor> = []
    const stored: Readonly<Record<string, ReadonlyArray<NodeRow>>> = {
        order: [ORDER],
        "sales-lead": [{ contactName: "An" }],
        "catalogue-item": [{ name: "small basket", imageUrl: "https://img/basket.png" }],
        "bank-transaction": [{ amountVnd: 2000 }],
        ...rows,
    }
    const registry = mock<GraphNodeRegistryService>({
        addExecutor: jest.fn((executor: NodeEffectExecutor) => void added.push(executor)),
        portOf: jest.fn((kind: string) =>
            mock<NodeDataPort>({ kind, read: jest.fn().mockResolvedValue(stored[kind] ?? []) }),
        ),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentMessagePostExecutorService,
            { provide: TeamChatAudienceService, useValue: chat },
            { provide: TeamChatStoreService, useValue: store },
            { provide: TeamChatCardsService, useValue: cards },
            { provide: GraphNodeRegistryService, useValue: registry },
        ],
    }).compile()
    moduleRef.get(AgentMessagePostExecutorService).onModuleInit()
    const postOf = () => chat.postTeamCard.mock.calls[0]?.[1]
    const messageOf = (): unknown => postOf()?.message
    return { chat, cards, registry, executor: added[0], messageOf, postOf }
}

describe("AgentMessagePostExecutorService", () => {
    it("registers itself for the team message post tool", async () => {
        expect((await build()).executor?.effect).toBe(TOOL.teamMessagePost)
    })

    it("builds the order card from the order, its customer and the catalogue: the caller names the order alone", async () => {
        const { chat, executor, messageOf, postOf } = await build()

        await expect(executor?.execute(TURN, { kind: "order.summary", orderId: "o1" }, CALL)).resolves.toEqual({
            kind: "chat-message",
            id: "msg-1",
            facts: POSTED_FACTS,
        })
        expect(chat.postTeamCard).toHaveBeenCalledWith("ws-1", expect.objectContaining({ agentId: "agent-1" }))
        expect(postOf()).toMatchObject({ audience: "own", key: "agent-message:order-notice:o1" })
        expect(messageOf()).toEqual({
            kind: "order.summary",
            intent: "notify",
            title: "New order DH-1",
            summary: "New order DH-1 · 1 x Small basket · 2.000 VND · customer An · deliver to 25 Nguyen Hue",
            payload: {
                orderNo: "DH-1",
                lines: [
                    {
                        name: "Small basket",
                        qty: 1,
                        unitText: "2.000 VND",
                        amountText: "2.000 VND",
                        imageUrl: "https://img/basket.png",
                    },
                ],
                amountText: "2.000 VND",
                customer: "An",
                address: "25 Nguyen Hue",
            },
            work: { label: "order", href: "/agents/sales/workbench" },
        })
    })

    it("drops a line, a total or a summary the caller typed beside the order id", async () => {
        const { executor, messageOf } = await build()
        const typed = { kind: "order.summary", orderId: "o1", summary: "FREE", payload: { amountText: "1 VND" } }
        await executor?.execute(TURN, typed, CALL)
        expect(messageOf()).toMatchObject({ payload: { amountText: "2.000 VND" } })
        expect(JSON.stringify(messageOf())).not.toContain("FREE")
    })

    it("builds the payment card with the amount of the bank credit that paid the order", async () => {
        const { executor, messageOf } = await build({ "bank-transaction": [{ amountVnd: 1500 }] })
        await executor?.execute(TURN, { kind: "payment.received", orderId: "o1" }, CALL)
        expect(messageOf()).toMatchObject({
            kind: "payment.received",
            title: "1.500 VND",
            summary: "Received 1.500 VND for DH-1",
            payload: { orderNo: "DH-1", amountText: "1.500 VND", customer: "An" },
        })
    })

    it("answers an order that is not there, and a payment card for an order no credit paid, as refusal facts and posts nothing", async () => {
        const missing = await build({ order: [] })
        await expect(missing.executor?.execute(TURN, { kind: "order.summary", orderId: "o9" }, CALL)).resolves.toEqual({
            kind: "refused",
            id: "order_missing",
            facts: {},
        })
        const unpaid = await build({ "bank-transaction": [] })
        await expect(
            unpaid.executor?.execute(TURN, { kind: "payment.received", orderId: "o1" }, CALL),
        ).resolves.toEqual({ kind: "refused", id: "not_paid", facts: {} })
        expect(missing.chat.postTeamCard).not.toHaveBeenCalled()
        expect(unpaid.chat.postTeamCard).not.toHaveBeenCalled()
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

describe("AgentMessagePostExecutorService the card of a stopped workflow", () => {
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
    const ASKED: Partial<ChatRoomMessageEntity> = { id: "m-1", roomId: "room-1", authorKind: "user", authorId: "u-1" }
    const ANSWER = { kind: "chat.answer", messageId: "m-1", text: "Phi ship noi thanh la 20.000 d." }
    const ANSWER_CALL: EffectCall = { key: "run-9:0", dedupeKey: "chat-answer:m-1:agent-1" }

    it("posts once in the asked room as a reply to the person's line, a typed message.text", async () => {
        const { cards, chat, executor } = await build({}, [ASKED])

        await expect(executor?.execute(ROOM_TURN, ANSWER, ANSWER_CALL)).resolves.toEqual({
            kind: "chat-message",
            id: "answer-1",
            facts: { roomId: "room-1", replyTo: "m-1" },
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
        expect(JSON.parse(line?.agentMessage ?? "null")).toMatchObject({ kind: "message.text", intent: "notify" })
        expect(chat.postTeamCard).not.toHaveBeenCalled()
    })

    it("answers the same dedupe key with the same line key (the store keeps one line)", async () => {
        const { cards, executor } = await build({}, [ASKED])
        await executor?.execute(ROOM_TURN, ANSWER, ANSWER_CALL)
        await executor?.execute(ROOM_TURN, ANSWER, ANSWER_CALL)
        const keys = cards.postMessage.mock.calls.map((call) => call[1].key)
        expect(new Set(keys).size).toBe(1)
    })

    it("refuses another room or an agent's line, and posts nothing", async () => {
        const other = await build({}, [ASKED])
        await expect(
            other.executor?.execute({ ...TURN, subject: { kind: "chat-room", id: "room-2" } }, ANSWER, ANSWER_CALL),
        ).resolves.toMatchObject({ id: "other_room" })
        expect(other.cards.postMessage).not.toHaveBeenCalled()

        const agentLine = await build({}, [{ ...ASKED, authorKind: "agent" }])
        await expect(agentLine.executor?.execute(ROOM_TURN, ANSWER, ANSWER_CALL)).resolves.toMatchObject({
            id: "not_person_line",
        })
        expect(agentLine.cards.postMessage).not.toHaveBeenCalled()
    })
})
