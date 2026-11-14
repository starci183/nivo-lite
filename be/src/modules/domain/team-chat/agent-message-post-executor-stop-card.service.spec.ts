import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { EffectCall } from "@nivo-lite/agent-sdk/node"
import { GraphNodeRegistryService, type NodeEffectExecutor, type NodeTurn } from "@modules/domain/graph-nodes"
import { AgentMessagePostExecutorService } from "./agent-message-post-executor.service"
import { lineKeyOf } from "./team-chat.policy"
import { TeamChatAudienceService } from "./team-chat-audience.service"
import { TeamChatCardsService } from "./team-chat-cards.service"
import { TeamChatStoreService } from "./team-chat-store.service"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { TEAM_CHAT_MESSAGES } from "./messages/team-chat.messages"

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
            { provide: TeamChatStoreService, useValue: mock<TeamChatStoreService>() },
            { provide: TeamChatCardsService, useValue: mock<TeamChatCardsService>() },
            { provide: GraphNodeRegistryService, useValue: registry },
        ],
    }).compile()
    moduleRef.get(AgentMessagePostExecutorService).onModuleInit()
    const postOf = () => chat.postTeamCard.mock.calls[0]?.[1]
    return { chat, executor: added[0], postOf }
}

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

describe("AgentMessagePostExecutorService the typed card of a thread's stop (workflow.stopped + stop)", () => {
    describe("posting and answering", () => {
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
    })

    describe("stopping again and taking over", () => {
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
    })

    describe("the old resolve path", () => {
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
})

/** The executor with the real team chat words (English) as its catalogue. */
const buildWorded = async () => {
    const chat = mock<TeamChatAudienceService>({
        postTeamCard: jest.fn().mockResolvedValue({ messageId: "msg-1", facts: {} }),
    })
    const added: Array<NodeEffectExecutor> = []
    const registry = mock<GraphNodeRegistryService>({
        addExecutor: jest.fn((executor: NodeEffectExecutor) => void added.push(executor)),
    })
    const words: Readonly<Record<string, string>> = TEAM_CHAT_MESSAGES.en
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => words[key] ?? key) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentMessagePostExecutorService,
            { provide: TeamChatAudienceService, useValue: chat },
            { provide: TeamChatStoreService, useValue: mock<TeamChatStoreService>() },
            { provide: TeamChatCardsService, useValue: mock<TeamChatCardsService>() },
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: MESSAGE_CATALOG, useValue: catalog },
        ],
    }).compile()
    moduleRef.get(AgentMessagePostExecutorService).onModuleInit()
    return { chat, executor: added[0], postOf: () => chat.postTeamCard.mock.calls[0]?.[1] }
}

describe("AgentMessagePostExecutorService worded facts on a thread's typed stop card", () => {
    const RAW_CARD = {
        workflow: { moduleKey: "accounting", key: "reconcile", title: "Reconcile incoming money" },
        step: { key: "match", nodeId: "accounting.match-payment", title: "Match the transaction" },
        runId: "run-1",
        leadId: null,
        conversationId: null,
        by: "engine",
        reason: "r",
        question: null,
        facts: [
            { name: "workflow", value: "accounting.reconcile" },
            { name: "step", value: "match (accounting.match-payment)" },
            { name: "code", value: "ai_confused" },
            { name: "bankName", value: "MBBANK" },
            { name: "run", value: "run-1" },
        ],
        suggestions: [],
        decisions: ["retry", "take_over", "skip"],
        repeats: 1,
        firstAt: "2026-11-10T10:00:00.000Z",
        lastAt: "2026-11-10T10:00:00.000Z",
    }
    const SECTION = {
        version: 1,
        stopId: "stop-1",
        runId: "run-1",
        stepKey: "match",
        kind: "ai_error",
        state: "open",
        headline: "The workflow stopped: AI error",
        needs: { answer: true, decisions: ["retry", "take_over", "skip"], verdicts: [] },
        replies: [],
        repeats: 1,
        stoppedAt: "2026-11-10T10:00:00.000Z",
        resolvedAt: null,
    }
    const CALL: EffectCall = { key: "run-stuck:run-1:match:1", dedupeKey: "run-stuck:run-1:match" }

    it("words the facts of a typed stop (titles, reason, bank name) and keeps every raw value only as technical", async () => {
        const { chat, executor, postOf } = await buildWorded()
        chat.storedCard.mockResolvedValue(null)

        await executor?.execute(TURN, { kind: "workflow.stopped", title: "t", summary: "r", card: { ...RAW_CARD, stop: SECTION } }, CALL)

        const facts = factsOfPayload(postOf()?.message.payload)
        expect(facts).toEqual([
            { name: "Workflow", value: "Reconcile incoming money", technical: false },
            { name: "Step", value: "Match the transaction", technical: false },
            { name: "Reason", value: "The AI could not tell what to do at this step.", technical: false },
            { name: "Bank", value: "MB Bank", technical: false },
            { name: "Workflow key", value: "accounting.reconcile", technical: true },
            { name: "Step key", value: "match (accounting.match-payment)", technical: true },
            { name: "Error code", value: "ai_confused", technical: true },
            { name: "Run id", value: "run-1", technical: true },
        ])
        const shown = facts.filter((fact) => !fact.technical).map((fact) => fact.value).join(" ")
        for (const raw of ["ai_confused", "MBBANK", "run-1", "accounting."]) expect(shown).not.toContain(raw)
    })

    it("leaves the facts of an old-engine card (no typed part) exactly as given", async () => {
        const { chat, executor, postOf } = await buildWorded()
        chat.storedCard.mockResolvedValue(null)

        await executor?.execute(TURN, { kind: "workflow.stopped", title: "t", summary: "r", card: RAW_CARD }, CALL)

        expect(factsOfPayload(postOf()?.message.payload)).toEqual(RAW_CARD.facts)
    })
})

/** A fact of a stored card. */
type Fact = { readonly name: string; readonly value: string; readonly technical?: boolean }

/** The facts of a posted card payload, or none when the payload carries no list of facts. */
const factsOfPayload = (payload: unknown): ReadonlyArray<Fact> => {
    if (typeof payload === "object" && payload !== null && "facts" in payload && Array.isArray(payload.facts)) return payload.facts.filter(isFact)
    return []
}
/** The English words of a catalogue key; empty for a missing key, so an expectation on it can never pass by accident. */
const en = (key: string): string => TEAM_CHAT_MESSAGES.en[key] ?? ""
/** The facts the stored card holds, already worded. */
const LINE_STORED_FACTS: ReadonlyArray<Fact> = [
    { name: "Workflow", value: "Reconcile incoming money", technical: false },
    { name: "Amount", value: "500 VND", technical: false },
    { name: "Step key", value: "match", technical: true },
    { name: "Run id", value: "run-1", technical: true },
]
/** The typed card as stored. */
const LINE_CARD = {
    workflow: { moduleKey: "accounting", key: "reconcile", title: "Reconcile incoming money" },
    step: { key: "match", nodeId: "accounting.match-payment", title: "Match the transaction" },
    runId: "run-1",
    leadId: null,
    conversationId: "conv-1",
    by: "ai",
    reason: "r",
    question: "q?",
    facts: LINE_STORED_FACTS,
    suggestions: [],
    decisions: ["retry", "take_over", "skip"],
    repeats: 1,
    firstAt: "2026-11-10T10:00:00.000Z",
    lastAt: "2026-11-10T10:00:00.000Z",
}
/** The stop section of the stored card, open. */
const LINE_OPEN = {
    version: 1,
    stopId: "stop-1",
    runId: "run-1",
    stepKey: "match",
    kind: "ai_report",
    state: "open",
    headline: "The workflow stopped",
    needs: { answer: true, decisions: ["retry", "take_over", "skip"], verdicts: [] },
    replies: [],
    repeats: 1,
    stoppedAt: "2026-11-10T10:00:00.000Z",
    resolvedAt: null,
}
const LINE_CALL: EffectCall = { key: "run-stuck:run-1:match:open:1:0:f6:ability_off", dedupeKey: "run-stuck:run-1:match" }
/** The raw line facts of a stop whose holding line the send refused. */
const NOT_TOLD = [
    { name: "customerLine", value: "not_told" },
    { name: "customerLineReason", value: "ability_off" },
]

/** A value read back as a card fact. */
const isFact = (value: unknown): value is Fact =>
    typeof value === "object" && value !== null && typeof Reflect.get(value, "name") === "string" && typeof Reflect.get(value, "value") === "string"

/** The executor over one stored card, and the facts of the card it folds in place, as stored (never filtered). */
const rewrittenWith = async (rewrite: Record<string, unknown>) => {
    const { chat, executor } = await buildWorded()
    chat.storedCard.mockResolvedValue({
        kind: "workflow.stopped",
        intent: "ask",
        title: "The workflow stopped",
        summary: "r",
        payload: { ...LINE_CARD, stop: { ...LINE_OPEN, revision: 1 } },
        occurrence: "run-stuck:run-1:match:1",
    })
    chat.foldTeamCard.mockResolvedValue("msg-1")
    await executor?.execute(TURN, { kind: "workflow.stopped", rewrite: { title: "t", summary: "s", stop: LINE_OPEN, ...rewrite } }, LINE_CALL)
    expect(chat.postTeamCard).not.toHaveBeenCalled()
    const facts: unknown = Reflect.get(chat.foldTeamCard.mock.calls[0]?.[2].payload ?? {}, "facts")
    const stored: ReadonlyArray<unknown> = Array.isArray(facts) ? facts : []
    return stored
}

describe("AgentMessagePostExecutorService the engine's holding line on a rewritten stop card (rewrite.lineFacts)", () => {
    it("stores the card with the line worded (not told, why, the code technical) and keeps every other stored fact", async () => {
        const facts = await rewrittenWith({ lineFacts: NOT_TOLD })

        expect(facts).toEqual([
            LINE_STORED_FACTS[0],
            LINE_STORED_FACTS[1],
            { name: en("teamChat.fact.customerLine"), value: en("teamChat.customerLine.notTold"), technical: false },
            { name: en("teamChat.fact.customerLineReason"), value: en("teamChat.lineReason.ability_off"), technical: false },
            LINE_STORED_FACTS[2],
            LINE_STORED_FACTS[3],
            { name: en("teamChat.fact.customerLineCode"), value: "ability_off", technical: true },
        ])
    })

    it.each([
        ["no lineFacts at all", {}],
        ["an empty lineFacts list", { lineFacts: [] }],
        ["lineFacts that are no { name, value } strings", { lineFacts: [{ name: 1, value: "x" }, "customerLine", null] }],
    ])("a rewrite with %s leaves the stored facts byte-equal", async (_name, rewrite) => {
        const facts = await rewrittenWith(rewrite)

        expect(JSON.stringify(facts)).toBe(JSON.stringify(LINE_STORED_FACTS))
    })

    it("an allowed send (the stop says nothing of the line) never shows a not-told fact", async () => {
        const facts = await rewrittenWith({ lineFacts: [] })

        expect(facts.every(isFact)).toBe(true)
        const shown = facts.filter(isFact).map((fact) => `${fact.name} ${fact.value}`).join(" | ")
        expect(shown).not.toContain(en("teamChat.customerLine.notTold"))
        expect(shown).not.toContain(en("teamChat.fact.customerLine"))
        expect(shown).not.toContain("not_told")
    })
})

describe("AgentMessagePostExecutorService the engine's report with facts (report.facts)", () => {
    const REPORT = {
        kind: "report.facts",
        title: "A turn could not run",
        text: "A turn stopped before the first step of a workflow, after its retries.",
        facts: [
            { name: "Channel", value: "Zalo", technical: false },
            { name: "Error code", value: "ENTITY_ENGINE_QUERY_INVALID", technical: true },
        ],
        audience: "founder",
    }

    it("posts one typed report to the founder under the call's key: the sentence as the readable line, the facts in the payload", async () => {
        const { executor, postOf } = await buildWorded()

        const fact = await executor?.execute(TURN, REPORT, { key: "wake-notice:w-1:failed:X", dedupeKey: "wake-notice:w-1:failed:X" })

        expect(fact).toMatchObject({ kind: "chat-message", id: "msg-1" })
        expect(postOf()).toEqual({
            agentId: "agent-1",
            audience: "founder",
            key: lineKeyOf("wake-notice:w-1:failed:X"),
            message: {
                kind: "report.facts",
                intent: "report",
                title: REPORT.title,
                summary: REPORT.text,
                payload: { text: REPORT.text, facts: REPORT.facts },
            },
        })
    })

    it("posts to the founder when the audience is missing or unknown", async () => {
        const { executor, postOf } = await buildWorded()
        await executor?.execute(TURN, { ...REPORT, audience: "customers" }, { key: "k", dedupeKey: null })
        expect(postOf()?.audience).toBe("founder")
    })

    it("refuses a report with no title or with a fact that has no value", async () => {
        const { executor, chat } = await buildWorded()
        await expect(executor?.execute(TURN, { ...REPORT, title: "" }, { key: "k", dedupeKey: null })).rejects.toThrow()
        await expect(
            executor?.execute(TURN, { ...REPORT, facts: [{ name: "Channel" }] }, { key: "k", dedupeKey: null }),
        ).rejects.toThrow()
        expect(chat.postTeamCard).not.toHaveBeenCalled()
    })
})
