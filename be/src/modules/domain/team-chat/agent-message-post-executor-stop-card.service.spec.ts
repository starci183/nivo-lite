import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { EffectCall } from "@nivo-lite/agent-sdk/node"
import { GraphNodeRegistryService, type NodeEffectExecutor, type NodeTurn } from "@modules/domain/graph-nodes"
import { AgentMessagePostExecutorService } from "./agent-message-post-executor.service"
import { lineKeyOf } from "./team-chat.policy"
import { TeamChatAudienceService } from "./team-chat-audience.service"

const TURN: NodeTurn = {
    turnId: "turn-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    subject: null,
    conversationId: null,
    locale: "vi",
}

const build = async () => {
    const chat = mock<TeamChatAudienceService>({
        postTeamCard: jest.fn().mockResolvedValue({ messageId: "msg-1", facts: {} }),
    })
    const added: Array<NodeEffectExecutor> = []
    const registry = mock<GraphNodeRegistryService>({
        addExecutor: jest.fn((executor: NodeEffectExecutor) => void added.push(executor)),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentMessagePostExecutorService,
            { provide: TeamChatAudienceService, useValue: chat },
            { provide: GraphNodeRegistryService, useValue: registry },
        ],
    }).compile()
    moduleRef.get(AgentMessagePostExecutorService).onModuleInit()
    const postOf = () => chat.postTeamCard.mock.calls[0]?.[1]
    return { chat, executor: added[0], postOf }
}

describe("AgentMessagePostExecutorService the typed card of a thread's stop (workflow.stopped + stop)", () => {
    const CARD = {
        workflow: { moduleKey: "accounting", key: "reconcile", title: "Doi soat tien ve" },
        step: { key: "match", nodeId: "accounting.match-payment", title: "Khop giao dich" },
        runId: "run-1",
        leadId: null,
        conversationId: null,
        by: "ai",
        reason: "Tiem nhan 500 VND cho don DH-0003, con thieu 500 VND.",
        question: "Ghi nhan da tra hay giu don mo?",
        facts: [{ name: "So tien", value: "500 VND" }],
        suggestions: [{ text: "Giu don mo", handledBy: "workflow" }],
        decisions: ["retry", "take_over", "skip"],
        repeats: 1,
        firstAt: "2026-11-10T10:00:00.000Z",
        lastAt: "2026-11-10T10:00:00.000Z",
    }
    const OPEN = {
        version: 1,
        stopId: "stop-1",
        runId: "run-1",
        stepKey: "match",
        kind: "ai_report",
        state: "open",
        headline: "Quy trinh dang dung",
        needs: { answer: true, decisions: ["retry", "take_over", "skip"], verdicts: [] },
        replies: [],
        repeats: 1,
        stoppedAt: "2026-11-10T10:00:00.000Z",
        resolvedAt: null,
    }
    const REPLY = { kind: "answer", text: "Giu don mo nhe", by: "seat-1", at: "2026-11-10T10:05:00.000Z" }
    const ANSWERED = {
        ...OPEN,
        state: "answered",
        headline: "Da nhan tra loi",
        needs: { answer: false, decisions: [], verdicts: [] },
        replies: [REPLY],
    }
    const CALL_OPEN: EffectCall = { key: "run-stuck:run-1:match:1", dedupeKey: "run-stuck:run-1:match" }
    const stored = (payload: unknown) => ({
        kind: "workflow.stopped",
        intent: "ask",
        title: "Quy trinh dang dung",
        summary: CARD.reason,
        payload,
        occurrence: CALL_OPEN.key,
    })

    it("posts the typed card once: the typed part kept on the payload, counted as the first write", async () => {
        const { chat, executor, postOf } = await build()
        chat.storedCard.mockResolvedValue(null)

        await executor?.execute(
            TURN,
            {
                kind: "workflow.stopped",
                title: "Quy trinh dang dung",
                summary: CARD.reason,
                card: { ...CARD, stop: OPEN },
            },
            CALL_OPEN,
        )

        expect(postOf()?.message).toMatchObject({
            intent: "ask",
            title: "Quy trinh dang dung",
            payload: { ...CARD, stop: { ...OPEN, revision: 1 } },
            options: [{ id: "0", label: "Giu don mo" }],
        })
    })

    it("rewrites the one card in place on an answer: the founder's reply kept, nothing asked, one write more, never a second card", async () => {
        const { chat, executor } = await build()
        chat.storedCard.mockResolvedValue(stored({ ...CARD, stop: { ...OPEN, revision: 1 } }))
        chat.foldTeamCard.mockResolvedValue("msg-1")

        const fact = await executor?.execute(
            TURN,
            {
                kind: "workflow.stopped",
                rewrite: { title: "Da nhan tra loi", summary: "Da nhan tra loi", stop: ANSWERED },
            },
            { key: "run-stuck:run-1:match:answered:1:1", dedupeKey: CALL_OPEN.dedupeKey },
        )

        expect(chat.postTeamCard).not.toHaveBeenCalled()
        expect(fact).toMatchObject({ id: "msg-1", facts: { rewritten: true, state: "answered", revision: 2 } })
        const [, key, message] = chat.foldTeamCard.mock.calls[0] ?? []
        expect(key).toBe(lineKeyOf("run-stuck:run-1:match"))
        expect(message).toMatchObject({
            intent: "notify",
            title: "Da nhan tra loi",
            options: [],
            occurrence: CALL_OPEN.key,
        })
        expect(message?.payload).toEqual({
            ...CARD,
            suggestions: [],
            decisions: [],
            resolvedAt: null,
            stop: { ...ANSWERED, revision: 2 },
        })
    })

    it("keeps the trace when the step stops again after the answer: the same card goes back to open under the new question", async () => {
        const { chat, executor } = await build()
        chat.storedCard.mockResolvedValue(stored({ ...CARD, stop: { ...ANSWERED, revision: 2 } }))
        chat.foldTeamCard.mockResolvedValue("msg-1")
        const again = { ...OPEN, repeats: 2, replies: [REPLY], stoppedAt: "2026-11-10T10:06:00.000Z" }

        await executor?.execute(
            TURN,
            {
                kind: "workflow.stopped",
                title: "Quy trinh dang dung",
                summary: "Con thieu?",
                card: { ...CARD, question: "Con thieu?", repeats: 2, stop: again },
            },
            { key: "run-stuck:run-1:match:2", dedupeKey: CALL_OPEN.dedupeKey },
        )

        expect(chat.postTeamCard).not.toHaveBeenCalled()
        const message = chat.foldTeamCard.mock.calls[0]?.[2]
        expect(message).toMatchObject({ intent: "ask", summary: "Con thieu?" })
        expect(message?.payload).toMatchObject({
            question: "Con thieu?",
            repeats: 2,
            stop: { state: "open", replies: [REPLY], revision: 3 },
        })
    })

    it("asks still after a take-over (words, retry, skip), and rewrites nothing when the stop never had a card", async () => {
        const { chat, executor } = await build()
        chat.storedCard.mockResolvedValue(stored({ ...CARD, stop: { ...OPEN, revision: 1 } }))
        chat.foldTeamCard.mockResolvedValue("msg-1")
        const taken = {
            ...OPEN,
            state: "answered",
            needs: { answer: true, decisions: ["retry", "skip"], verdicts: [] },
        }

        await executor?.execute(
            TURN,
            { kind: "workflow.stopped", rewrite: { title: "t", summary: "s", stop: taken } },
            CALL_OPEN,
        )
        expect(chat.foldTeamCard.mock.calls[0]?.[2]).toMatchObject({
            intent: "ask",
            payload: { decisions: ["retry", "skip"] },
        })

        chat.storedCard.mockResolvedValue(null)
        chat.foldTeamCard.mockClear()
        await expect(
            executor?.execute(
                TURN,
                { kind: "workflow.stopped", rewrite: { title: "t", summary: "s", stop: taken } },
                CALL_OPEN,
            ),
        ).resolves.toMatchObject({ facts: { rewritten: false } })
        expect(chat.foldTeamCard).not.toHaveBeenCalled()
        expect(chat.postTeamCard).not.toHaveBeenCalled()
    })

    it("marks the typed part resolved too when the old resolve path rewrites a typed card", async () => {
        const { chat, executor } = await build()
        chat.storedCard.mockResolvedValue(stored({ ...CARD, stop: { ...OPEN, revision: 1 } }))
        chat.foldTeamCard.mockResolvedValue("msg-1")
        const at = "2026-11-10T11:00:00.000Z"

        await executor?.execute(
            TURN,
            { kind: "workflow.stopped", resolved: { title: "Xong", summary: "Xong", at } },
            CALL_OPEN,
        )

        expect(chat.foldTeamCard.mock.calls[0]?.[2].payload).toMatchObject({
            resolvedAt: at,
            stop: {
                state: "resolved",
                needs: { answer: false, decisions: [], verdicts: [] },
                resolvedAt: at,
                revision: 2,
            },
        })
    })
})
