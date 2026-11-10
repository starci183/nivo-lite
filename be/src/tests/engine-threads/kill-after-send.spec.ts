import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { TOOL } from "@nivo-lite/blocks-core"
import { AiTasksService } from "@modules/domain/ai-tasks"
import type { AgentTurnView } from "@modules/domain/agent-work"
import { GRAPH_NODE_MODEL, type NodeModelDoor } from "@modules/domain/graph-nodes"
import { AI, type AiService } from "@modules/integrations/ai"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import { LOGGER, runInScope, type Logger } from "@modules/platform/logging"
import { TIMER, type Timer } from "@modules/platform/retry"
import { AI_TASKS_METER, AI_TASKS_OPTIONS } from "../../modules/domain/ai-tasks/ai-tasks.decorators"
import type { AiTaskMeter } from "../../modules/domain/ai-tasks/ai-tasks.port"
import { NodeImagesService } from "../../modules/domain/ai-tasks/node-images.service"
import { NotesService } from "../../modules/domain/ai-tasks/notes.service"
import { agentTurnViewOf } from "../fixtures/builders/agent-work.builder"
import { CONV, WS, actsOf, redrive, rowsOf, runsViewOf, stopsOf, type ThreadProcess } from "./thread-world"
import { CONSULT_WORKFLOW, SALES, consultWake, linesOf, moneyDbOf, type MoneyDb } from "./workflows/reconcile/thread-world-money"
import { moneyProcessOf } from "./workflows/reconcile/thread-world-money-process"

// Package FX1 (D-P10-6, D-P10-7): the LIVE sequence of run 3355daf0 on dev (restart FOURTEEN), with the REAL run reader (records +
// mapper, `AgentRunsViewService`) and the REAL tries policy (`AiTasksService.nodeJson`) over a scripted AI endpoint. The consult's first
// try times out, the second answers, the step tells the customer one holding line, and the process dies right after that send with the
// step still `running` (its row: `graph_node`, consult, running, effect pivot, result null, deadline null). A new process then runs the
// SAME wake again (the work core's retry) or the sweep's re-drive. Live, both failed in 0.1 s with `AGENT_RUNS_RESULT_REJECTED`: the
// thread runs read the run's engine through the run page's reader, whose step mapper refused the projection's `deadlineMs: null`. The
// world faked that reader, so no spec saw it. Now: the step continues (the ledger answers the send), ONE customer line, the run ends.

const HOLDING = "Da em can hoi chu tiem xac nhan, em hoi roi bao minh som a."
const ASKED = {
    branch: "asked",
    leadId: "lead-1",
    items: [],
    address: null,
    recipientName: null,
    recipientPhone: null,
    deliveryAt: null,
}

type Attempt = "fails" | Readonly<Record<string, unknown>>

/** What the scripted endpoint saw: each try, and the run the metering scope named at that moment (D-P10-7). */
interface Endpoint {
    readonly door: NodeModelDoor
    readonly tries: () => number
    readonly runsInScope: Array<string | null>
}

/** The model door the app binds (`AiTasksService`) over an AI endpoint that answers each try as scripted, in order. */
const endpointOf = async (attempts: Array<Attempt>): Promise<Endpoint> => {
    const runsInScope: Array<string | null> = []
    const ai = mock<AiService>()
    ai.available.mockReturnValue(true)
    ai.attempt.mockImplementation(() => {
        runsInScope.push(runInScope())
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
            // As on dev: the Anthropic key is set, so the node's model (every node on Claude Sonnet) is served there.
            { provide: AI_TASKS_OPTIONS, useValue: { timeoutMs: 30_000, providers: { anthropic: true, openrouter: true } } },
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
    return { door: moduleRef.get(AiTasksService), tries: () => ai.attempt.mock.calls.length, runsInScope }
}

const send = { call: { tool: TOOL.customerMessageSend, args: { conversationId: CONV, text: HOLDING } } }

/** One process of the money world on the thread engine for the consult, with the REAL tries policy as its model door. */
const processOf = (db: MoneyDb, endpoint: Endpoint): Promise<ThreadProcess> =>
    moneyProcessOf(db, [CONSULT_WORKFLOW], [{ provide: GRAPH_NODE_MODEL, useValue: endpoint.door }])

/** The process dies on the first `done` write of a step row: the send is in the ledger, the step row still says `running`. */
const diesRightAfterTheSend = (db: MoneyDb): void => {
    db.records.crashOnce(
        (mutation) => mutation.entity === "agent.run-step" && mutation.op === "update" && mutation.values.status === "done",
    )
}

/** The consult's hand-off wake, as one turn of the work core; the same wake tried again keeps its id under a fresh fence. */
const turnOf = (db: MoneyDb, wakeId: string, attempts = 1): AgentTurnView => {
    db.fence += 1
    const input = consultWake("Shop oi bo hong mini giam cho minh 20% duoc khong a?")
    return agentTurnViewOf({
        workspaceId: WS,
        agentId: SALES,
        wakeId,
        eventKey: input.eventKey,
        source: "tag",
        scopeKey: input.scopeKey,
        context: structuredClone(input.context),
        actorMemberId: null,
        fence: db.fence,
        turnId: `turn-${String(db.fence)}`,
        attempts,
    })
}

const runOfWake = (db: MoneyDb, wakeId: string): string =>
    [...db.runs.values()].find((run) => run.wakeId === wakeId)?.id ?? ""

const statusOf = async (process: ThreadProcess, runId: string) =>
    (await process.threads.stateOf({ workspaceId: WS, runId }))?.status

/** Try 1 times out, try 2 answers the send, then `done`; after the restart the re-run step asks again (the ledger answers the send). */
const LIVE: ReadonlyArray<Attempt> = ["fails", send, { done: ASKED }, send, { done: ASKED }, send, { done: ASKED }]

/** Plays the live first process: the timeout, the answer, the one holding line, and the death right after it. */
const killedAfterTheSend = async () => {
    const db = moneyDbOf()
    const endpoint = await endpointOf([...LIVE])
    diesRightAfterTheSend(db)
    const first = await processOf(db, endpoint)
    const turn = turnOf(db, "wake-live")
    const died = await first.flows.run(turn, new AbortController().signal).then(
        () => null,
        (error: unknown) => error,
    )
    return { db, endpoint, died, runId: runOfWake(db, "wake-live") }
}

describe("FX1: the api is killed right after a step told the customer (D-P10-6, run 3355daf0)", () => {
    it("leaves the live state: one holding line, the step row running at a pivot with no result", async () => {
        const { db, endpoint, died, runId } = await killedAfterTheSend()

        expect(String(died)).toContain("WORLD_PROCESS_DIED")
        expect(endpoint.tries()).toBe(3)
        expect(linesOf(db)).toEqual([HOLDING])
        const [step] = rowsOf(db, runId).steps
        expect(step).toMatchObject({
            kind: "graph_node",
            stepKey: "consult",
            status: "running",
            effect: { kind: "pivot" },
            result: null,
        })
        expect(rowsOf(db, runId).run).toMatchObject({ engine: "langgraph", status: "running" })
    })

    it("the run page reads that run through the REAL reader (it refused the step row before)", async () => {
        const { db, runId } = await killedAfterTheSend()

        const detail = await runsViewOf(db.records).detail(WS, SALES, runId)

        expect(detail?.engine).toBe("langgraph")
        expect(detail?.steps.map((step) => [step.stepKey, step.status])).toEqual([["consult", "running"]])
        expect(rowsOf(db, runId).steps[0]?.deadlineMs).toBe(120_000)
    })

    it("a step row written before the fix (deadline null, as every thread step row on dev) is read, and its wake runs again", async () => {
        const { db, endpoint, runId } = await killedAfterTheSend()
        for (const held of db.records.rows.values())
            if (held.entity === "agent.run-step") held.row = { ...held.row, data: { ...held.row.data, deadlineMs: null } }
        const second = await processOf(db, endpoint)

        expect((await runsViewOf(db.records).detail(WS, SALES, runId))?.engine).toBe("langgraph")
        const retried = await second.flows.run(turnOf(db, "wake-live", 2), new AbortController().signal)

        expect(retried).toMatchObject({ status: "done" })
        expect(linesOf(db)).toEqual([HOLDING])
        expect(rowsOf(db, runId).run).toMatchObject({ status: "done" })
    })

    it("a new process runs the SAME wake again: the step continues, no second line, the run ends done, no stop", async () => {
        const { db, endpoint, runId } = await killedAfterTheSend()
        const second = await processOf(db, endpoint)

        const retried = await second.flows.run(turnOf(db, "wake-live", 2), new AbortController().signal).then(
            (ending) => ({ ending, error: null }),
            (error: unknown) => ({ ending: null, error }),
        )

        expect(retried.error).toBeNull()
        expect(retried.ending).toMatchObject({ status: "done" })
        expect(await statusOf(second, runId)).toBe("ended")
        expect(linesOf(db)).toEqual([HOLDING])
        expect(actsOf(db, TOOL.customerMessageSend)).toHaveLength(1)
        expect(rowsOf(db, runId).run).toMatchObject({ status: "done" })
        expect(rowsOf(db, runId).steps).toEqual([expect.objectContaining({ stepKey: "consult", status: "done" })])
        expect(await stopsOf(second, runId)).toEqual([])
    })

    it("the sweep's re-drive of the dead wake is admitted and continues the step the same way", async () => {
        const { db, runId } = await killedAfterTheSend()
        const second = await processOf(db, await endpointOf([send, { done: ASKED }, send, { done: ASKED }]))

        const ran = await redrive(second, runId, "sweep-1")

        expect(ran.map((one) => one.error)).toEqual([null])
        expect(await statusOf(second, runId)).toBe("ended")
        expect(linesOf(db)).toEqual([HOLDING])
        expect(actsOf(db, TOOL.customerMessageSend)).toHaveLength(1)
        expect(rowsOf(db, runId).run).toMatchObject({ status: "done" })
    })

    it("every model try of the thread's step is metered to its run, before and after the restart (D-P10-7)", async () => {
        const { db, endpoint, runId } = await killedAfterTheSend()
        const second = await processOf(db, endpoint)
        await second.flows.run(turnOf(db, "wake-live", 2), new AbortController().signal)

        expect(endpoint.runsInScope.length).toBeGreaterThan(3)
        expect(new Set(endpoint.runsInScope)).toEqual(new Set([runId]))
    })
})
