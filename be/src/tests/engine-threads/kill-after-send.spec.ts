import { Test } from "@nestjs/testing"
import { AGENT_RUN_STEPS } from "@tests/fixtures/builders/engine-core-tables.builder"
import { mock } from "@starci/jest-preset"
import { TOOL } from "@nivo-lite/agent-sdk/names"
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
import { CONTACT, CONV, WS, actsOf, redrive, rowsOf, runsViewOf, stopsOf, type ThreadProcess } from "./thread-world"
import { SALES, linesOf, moneyDbOf, type MoneyDb } from "./workflows/reconcile/thread-world-money"
import { moneyProcessOf } from "./workflows/reconcile/thread-world-money-process"
import { calledWorkflow, type HeardWake } from "./thread-world-intake"

// Package FX1 (D-P10-6, D-P10-7): the LIVE sequence of run 3355daf0 on dev (restart FOURTEEN), with the REAL run reader (records +
// mapper, `AgentRunsViewService`) and the REAL tries policy (`AiTasksService.nodeJson`) over a scripted AI endpoint. The consult's first
// try times out, the second answers, the step tells the customer one holding line, and the process dies right after that send with the
// step still `running` (its row: `graph_node`, consult, running, effect pivot, result null, deadline null). A new process then runs the
// SAME wake again (the work core's retry) or the sweep's re-drive. Live, both failed in 0.1 s with `AGENT_RUNS_RESULT_REJECTED`: the
// thread runs read the run's engine through the run page's reader, whose step mapper refused the projection's `deadlineMs: null`. The
// world faked that reader, so no spec saw it. Now: the step continues (the ledger answers the send), ONE customer line, the run ends.

const HOLDING = "Da em can hoi chu tiem xac nhan, em hoi roi bao minh som a."
/**
 * The consult turn's answer (version 9, the flip): the turn's agent writes the holding line as its `reply`, and the node sends it (the
 * agent itself calls no send). The send is still the step's own act, and the process still dies right after it.
 */
const ASKED = {
    branch: "asked",
    reply: HOLDING,
    items: [],
    address: null,
    recipientName: null,
    recipientPhone: null,
    deliveryAt: null,
    occasions: null,
    cancelOrderId: null,
    cancelReason: null,
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

/** One process of the money world on the thread engine for the consult, with the REAL tries policy as its model door. */
const processOf = (db: MoneyDb, endpoint: Endpoint): Promise<ThreadProcess> =>
    moneyProcessOf(db, [{ provide: GRAPH_NODE_MODEL, useValue: endpoint.door }])

/** The process dies on the first `done` write of a step row: the send is in the ledger, the step row still says `running`. */
const diesRightAfterTheSend = (db: MoneyDb): void => {
    // The talk loop's round 1 starts with its `opening` step (a data `if`), whose `done` write comes first: the consult's is the second.
    let doneWrites = 0
    db.records.crashOnce((mutation) => {
        if (mutation.entity !== AGENT_RUN_STEPS || mutation.op !== "update" || mutation.values.status !== "done") return false
        doneWrites += 1
        return doneWrites === 2
    })
}

/** The hand-off wake each database's delivery wrote (written once: the same wake is tried again). */
const handedOff = new WeakMap<MoneyDb, HeardWake>()

/** The consult's hand-off, as the REAL `deliver` of the call writes its wake, as one turn of the work core; the same wake tried again keeps its id under a fresh fence. */
const turnOf = async (db: MoneyDb, wakeId: string, attempts = 1): Promise<AgentTurnView> => {
    db.fence += 1
    if (!handedOff.has(db)) {
        const [written] = await calledWorkflow(db, {
            agentId: SALES,
            workflow: "consult",
            params: { conversationId: CONV, text: "Shop oi bo hong mini giam cho minh 20% duoc khong a?", channel: "zalo", contactId: CONTACT },
            key: "call:front-desk:kill",
            contactId: CONTACT,
            routeId: CONV,
        })
        if (written !== undefined) handedOff.set(db, written)
    }
    const input = handedOff.get(db)
    return agentTurnViewOf({
        workspaceId: WS,
        agentId: SALES,
        wakeId,
        eventKey: input?.eventKey ?? "",
        source: input?.source ?? "trigger",
        scopeKey: input?.scopeKey ?? "",
        context: structuredClone(input?.context ?? {}),
        actorMemberId: null,
        fence: db.fence,
        turnId: `turn-${String(db.fence)}`,
        attempts,
    })
}

/** The consult step of the sale's first talk round (the body step of the `talk` loop). */
const CONSULT_STEP = "talk[r1].consult"

const runOfWake = (db: MoneyDb, wakeId: string): string =>
    [...db.runs.values()].find((run) => run.wakeId === wakeId)?.id ?? ""

const statusOf = async (process: ThreadProcess, runId: string) =>
    (await process.threads.stateOf({ workspaceId: WS, runId }))?.status

/**
 * Try 1 times out, try 2 answers the turn with the holding line (the node sends it); after the restart the re-run step asks again (the
 * ledger answers the send). On the old consult the agent sent itself: three tries before the death (timeout, send, done), now two.
 */
const LIVE: ReadonlyArray<Attempt> = ["fails", { done: ASKED }, { done: ASKED }, { done: ASKED }]

/** Plays the live first process: the timeout, the answer, the one holding line, and the death right after it. */
const killedAfterTheSend = async () => {
    const db = moneyDbOf()
    const endpoint = await endpointOf([...LIVE])
    diesRightAfterTheSend(db)
    const first = await processOf(db, endpoint)
    const turn = await turnOf(db, "wake-live")
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
        expect(endpoint.tries()).toBe(2)
        expect(linesOf(db)).toEqual([HOLDING])
        // The sale starts in its talk loop: the loop node `talk` is a read, the consult is its round-1 body step.
        const step = rowsOf(db, runId).steps.find((row) => row.stepKey === CONSULT_STEP)
        expect(step).toMatchObject({
            kind: "graph_node",
            stepKey: CONSULT_STEP,
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
        expect(detail?.steps.map((step) => [step.stepKey, step.status])).toEqual([
            ["talk", "running"],
            ["talk[r1].opening", "done"],
            [CONSULT_STEP, "running"],
        ])
        expect(rowsOf(db, runId).steps.find((row) => row.stepKey === CONSULT_STEP)?.deadlineMs).toBe(120_000)
    })

    it("a step row written before the fix (deadline null, as every thread step row on dev) is read, and its wake runs again", async () => {
        const { db, endpoint, runId } = await killedAfterTheSend()
        for (const held of db.records.rows.values())
            if (held.entity === AGENT_RUN_STEPS) held.row = { ...held.row, data: { ...held.row.data, deadlineMs: null } }
        const second = await processOf(db, endpoint)

        expect((await runsViewOf(db.records).detail(WS, SALES, runId))?.engine).toBe("langgraph")
        const retried = await second.flows.run(await turnOf(db, "wake-live", 2), new AbortController().signal)

        expect(retried).toMatchObject({ status: "done" })
        expect(linesOf(db)).toEqual([HOLDING])
        // The sale is one run: after the consult's `asked` it PARKS at its talk wait (the run is not over).
        expect(rowsOf(db, runId).run).toMatchObject({ status: "running" })
    })

    it("a new process runs the SAME wake again: the step continues, no second line, the run parks at its wait, no stop", async () => {
        const { db, endpoint, runId } = await killedAfterTheSend()
        const second = await processOf(db, endpoint)

        const retried = await second.flows.run(await turnOf(db, "wake-live", 2), new AbortController().signal).then(
            (ending) => ({ ending, error: null }),
            (error: unknown) => ({ ending: null, error }),
        )

        expect(retried.error).toBeNull()
        expect(retried.ending).toMatchObject({ status: "done" })
        // The sale is one run: the consult asked, so the run PARKS at its talk wait (stopped on the thread, not ended).
        expect(await statusOf(second, runId)).toBe("stopped")
        expect(linesOf(db)).toEqual([HOLDING])
        expect(actsOf(db, TOOL.customerMessageSend)).toHaveLength(1)
        expect(rowsOf(db, runId).run).toMatchObject({ status: "running" })
        // Round 1: its consult step is done once; round 2 opens and its `hear` wait is running (parked).
        expect(rowsOf(db, runId).steps.map((step) => [step.stepKey, step.status])).toEqual([
            ["talk", "running"],
            ["talk[r1].opening", "done"],
            [CONSULT_STEP, "done"],
            ["talk[r2].opening", "done"],
            ["talk[r2].hear", "running"],
        ])
        expect(await stopsOf(second, runId)).toEqual([])
    })

    it("the sweep's re-drive of the dead wake is admitted and continues the step the same way", async () => {
        const { db, runId } = await killedAfterTheSend()
        const second = await processOf(db, await endpointOf([{ done: ASKED }, { done: ASKED }]))

        const ran = await redrive(second, runId, "sweep-1")

        expect(ran.map((one) => one.error)).toEqual([null])
        expect(await statusOf(second, runId)).toBe("stopped")
        expect(linesOf(db)).toEqual([HOLDING])
        expect(actsOf(db, TOOL.customerMessageSend)).toHaveLength(1)
        expect(rowsOf(db, runId).run).toMatchObject({ status: "running" })
    })

    it("every model try of the thread's step is metered to its run, before and after the restart (D-P10-7)", async () => {
        const { db, endpoint, runId } = await killedAfterTheSend()
        const second = await processOf(db, endpoint)
        await second.flows.run(await turnOf(db, "wake-live", 2), new AbortController().signal)

        // The re-run step asks no model after the restart: the turn's answer is a recorded call the ledger answers (finding F2 of the
        // flip: 3 tries before the death and more after it on the old consult; 2 before, none after, now). Every try is the run's.
        expect(endpoint.runsInScope).toHaveLength(2)
        expect(new Set(endpoint.runsInScope)).toEqual(new Set([runId]))
    })
})
