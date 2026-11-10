import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { TOOL } from "@nivo-lite/blocks-core"
import { AiTasksService } from "@modules/domain/ai-tasks"
import type { NodeModelDoor } from "@modules/domain/graph-nodes"
import { AI, type AiService } from "@modules/integrations/ai"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { TIMER, type Timer } from "@modules/platform/retry"
import { AI_TASKS_METER, AI_TASKS_OPTIONS } from "../../modules/domain/ai-tasks/ai-tasks.decorators"
import type { AiTaskMeter } from "../../modules/domain/ai-tasks/ai-tasks.port"
import { NodeImagesService } from "../../modules/domain/ai-tasks/node-images.service"
import { NotesService } from "../../modules/domain/ai-tasks/notes.service"
import {
    AGENT_FIRST_TRY_MS,
    AGENT_RETRY_MS,
    ANSWER,
    CONV,
    CORE,
    FRONT_DESK,
    UNDERSTAND,
    WS,
    actsOf,
    customerWrites,
    processOf,
    rowsOf,
    stopsOf,
    threadDbOf,
} from "./thread-world"

// Package 0-9, item 7: the AI's own failure on a thread, through the REAL tries policy (`AiTasksService.nodeJson`: three tries in
// total) over a scripted AI endpoint. Three failed tries: exactly one engine-written stop of kind `ai_error` with the tries, and the AI
// core is not asked (no fourth call). Two failed tries, then an answer: no stop.

type Attempt = "fails" | Readonly<Record<string, unknown>>

/** The model door the app binds (`AiTasksService`) over an AI endpoint that answers each attempt as scripted, in order. */
const aiTasksOver = async (
    attempts: Array<Attempt>,
): Promise<{ readonly door: NodeModelDoor; readonly calls: () => number }> => {
    const ai = mock<AiService>()
    ai.available.mockReturnValue(true)
    ai.attempt.mockImplementation(() => {
        const next = attempts.shift()
        if (next === undefined || next === "fails") return Promise.resolve({ ok: false, failure: "timeout" })
        return Promise.resolve({
            ok: true,
            answer: {
                text: JSON.stringify(next),
                usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2, costUsd: 0 },
                model: "m",
                parsed: null,
                retrieved: 0,
            },
        })
    })
    const meter = mock<AiTaskMeter>()
    meter.blockedBy.mockResolvedValue(null)
    const timer = mock<Timer>({
        schedule: jest.fn((callback: () => void) => {
            callback()
            return () => undefined
        }),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AiTasksService,
            // The world names its provider: every node model (Auto or the ALL_NODES_ON_CLAUDE switch) is served by Anthropic.
            { provide: AI_TASKS_OPTIONS, useValue: { timeoutMs: 30_000, providers: { anthropic: true, openrouter: false } } },
            { provide: AI, useValue: ai },
            { provide: AI_TASKS_METER, useValue: meter },
            { provide: NotesService, useValue: mock<NotesService>() },
            {
                provide: NodeImagesService,
                useValue: mock<NodeImagesService>({
                    inline: jest.fn(() => Promise.resolve({ images: [], dropped: 0 })),
                }),
            },
            { provide: MESSAGE_CATALOG, useValue: { get: (key: string) => key } },
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: TIMER, useValue: timer },
        ],
    }).compile()
    return { door: moduleRef.get(AiTasksService), calls: () => ai.attempt.mock.calls.length }
}

describe("the AI fails on a thread", () => {
    it("three failed tries: one ai_error stop written by the engine with the tries; no AI-core call", async () => {
        const db = threadDbOf()
        const model = await aiTasksOver(["fails", "fails", "fails"])
        const process = await processOf(db, { flag: [FRONT_DESK], model: model.door })

        const woken = await customerWrites(process, "Shop mo cua may gio?")
        const runId = woken.runId ?? ""

        expect(woken.error).toBeNull()
        expect(model.calls()).toBe(3)
        const stops = await stopsOf(process, runId)
        expect(stops.map((stop) => [stop.stepKey, stop.kind, stop.state])).toEqual([["understand", "ai_error", "open"]])
        expect(stops[0]?.detail.facts).toEqual(expect.arrayContaining([{ name: "tries", value: "3" }]))
        expect(stops[0]?.detail.facts.find((fact) => fact.name === "code")?.value).toBe("AI_TASKS_UNAVAILABLE")
        expect(stops[0]?.reason).toBe("agentGraphs.stuck.aiFailed")
        expect(actsOf(db, TOOL.teamMessagePost)).toHaveLength(1)
        expect(actsOf(db, TOOL.customerMessageSend)).toEqual([])
        expect((await process.threads.stateOf({ workspaceId: WS, runId }))?.status).toBe("stopped")
        expect(rowsOf(db, runId).run).toMatchObject({ status: "waiting", engine: "langgraph" })
    })

    it("two failed tries, then an answer: no stop, the run goes on to its end", async () => {
        const db = threadDbOf()
        const model = await aiTasksOver([
            "fails",
            "fails",
            { answer: { branch: "question", summary: "Lan: gio mo cua" } },
            { call: { tool: TOOL.customerMessageSend, args: { conversationId: CONV, text: "Shop mo cua 8h-21h a." } } },
            { done: { reply: "Shop mo cua 8h-21h a." } },
        ])
        const process = await processOf(db, { flag: [FRONT_DESK], model: model.door })

        const runId = (await customerWrites(process, "Shop mo cua may gio?")).runId ?? ""

        expect(model.calls()).toBe(5)
        expect(await stopsOf(process, runId)).toEqual([])
        expect((await process.threads.stateOf({ workspaceId: WS, runId }))?.status).toBe("ended")
        expect(actsOf(db, TOOL.customerMessageSend)).toHaveLength(1)
        expect(actsOf(db, TOOL.teamMessagePost)).toEqual([])
    })
})

// L2-5 (package P8): the same rule on the host's own agent loop (`AGENT_LOOP=prebuilt:chatbot.answer`): every model TURN of the
// prebuilt agent gets three tries in total through the REAL tries policy (`AiTasksService.nodeAgentTurns` over the REAL `AiService`),
// 90 s for the first and 45 s for each retry, then the engine's common "AI failed" stop. Nothing the turn failed on reaches the model.
describe("the AI fails on a turn of the prebuilt agent loop", () => {
    const ANSWERS = "chatbot.answer"
    const timeout = (): Error => Object.assign(new Error("deadline"), { name: "TimeoutError" })

    it("three failed tries of one turn: one ai_error stop with the tries and each failure; no fourth call, no AI-core call", async () => {
        const db = threadDbOf()
        db.model.script(UNDERSTAND, { answer: { branch: "question", summary: "Lan: gio mo cua" } })
        db.model.script(ANSWER, timeout(), new Error("502 from the upstream"), { cut: true }, { done: { reply: "never" } })
        const process = await processOf(db, { flag: [FRONT_DESK], agentLoop: [ANSWERS] })

        const runId = (await customerWrites(process, "Shop mo cua may gio?")).runId ?? ""

        const tries = db.model.tries.filter((one) => one.purpose === ANSWER)
        expect(tries.map((one) => one.request.timeoutMs)).toEqual([AGENT_FIRST_TRY_MS, AGENT_RETRY_MS, AGENT_RETRY_MS])
        // A 2 s pause before the retry of the provider error only.
        expect(db.model.pauses).toEqual([2000])
        expect(db.model.left(ANSWER)).toBe(1)
        expect(db.model.askedOf(CORE)).toHaveLength(0)
        const stops = await stopsOf(process, runId)
        expect(stops.map((stop) => [stop.stepKey, stop.kind, stop.state])).toEqual([["answer", "ai_error", "open"]])
        expect(stops[0]?.detail.facts).toEqual(
            expect.arrayContaining([
                { name: "code", value: "AI_TASKS_UNAVAILABLE" },
                { name: "tries", value: "3" },
                { name: "failures", value: "timeout, provider, length" },
            ]),
        )
        expect(stops[0]?.reason).toBe("agentGraphs.stuck.aiFailed")
        expect(actsOf(db, TOOL.customerMessageSend)).toEqual([])
        expect((await process.threads.stateOf({ workspaceId: WS, runId }))?.status).toBe("stopped")
    })

    it("two failed tries, then an answer: the turn goes on with that answer and the step completes, no stop", async () => {
        const db = threadDbOf()
        db.model.script(UNDERSTAND, { answer: { branch: "question", summary: "Lan: gio mo cua" } })
        const reply = "Shop mo cua 8h-21h a."
        db.model.script(
            ANSWER,
            timeout(),
            timeout(),
            { call: { tool: TOOL.customerMessageSend, args: { conversationId: CONV, text: reply } } },
            { done: { reply } },
        )
        const process = await processOf(db, { flag: [FRONT_DESK], agentLoop: [ANSWERS] })

        const runId = (await customerWrites(process, "Shop mo cua may gio?")).runId ?? ""

        expect(db.model.tries.filter((one) => one.purpose === ANSWER)).toHaveLength(4)
        expect(await stopsOf(process, runId)).toEqual([])
        expect((await process.threads.stateOf({ workspaceId: WS, runId }))?.status).toBe("ended")
        expect(actsOf(db, TOOL.customerMessageSend).map((act) => act.payload.text)).toEqual([reply])
    })
})
