import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { AgentGraphFlowRunsService } from "@modules/domain/agent-graphs"
import { AgentRunsService, type StoredWaiter } from "@modules/domain/agent-runs"
import { GRAPH_THREADS, type GraphThreads, type ThreadView } from "@modules/integrations/langgraph"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { agentTurnViewOf } from "@tests/fixtures/builders/agent-work.builder"
import { ThreadRunsService } from "./thread-runs.service"
import { waitOfferOrder, waitParkOf, type WaitPark } from "./thread-waits.policy"
import { ThreadWaitsService } from "./thread-waits.service"
import { waitMatchKeysOf, waitMatchProbeOf, type WaitMatchProbe } from "./wait-match.policy"

const CREDIT = "payment.credit.received"
const LINE = "zalo.message.received"

/** A parked payment wait of the sale: the credit whose transfer text holds the run's order code, or the person's next line. */
const paymentParkOf = (orderNo: string, routeId: string): WaitPark =>
    waitParkOf(
        "pay[r1].await",
        "2026-11-15T00:00:00.000Z",
        [
            { key: "paid", verb: CREDIT, match: [{ member: "data.content", op: "contains", value: orderNo, caseFold: true }] },
            { key: "said", verb: LINE },
        ],
        { routeId, contactId: `contact-${routeId}` },
    )

/** 60 sale runs, each parked on its own order code; run 0 started waiting FIRST (the oldest), run 59 last. */
const RUNS: ReadonlyArray<{ readonly id: string; readonly park: WaitPark; readonly since: string }> = Array.from({ length: 60 }, (_, at) => ({
    id: `run-${String(at).padStart(2, "0")}`,
    park: paymentParkOf(`DH${String(1000 + at)}`, `route-${String(at)}`),
    since: new Date(Date.UTC(2026, 10, 14, 0, at)).toISOString(),
}))

/**
 * The store's `waiters` as the SQL reads `wait_match` (agent-run-table-store.typeorm.ts): a run whose keys overlap the probe's exact keys,
 * or whose keys hold one of the probe's markers AND one part that lies in the event's text of that part's prefix. Every run, no page.
 */
const waitersOf = (probe: WaitMatchProbe): ReadonlyArray<StoredWaiter> =>
    RUNS.filter(({ park }) => {
        const keys = waitMatchKeysOf(park)
        if (keys.some((key) => probe.exact.includes(key))) return true
        if (!keys.some((key) => probe.markers.includes(key))) return false
        return keys.some((key) =>
            Object.entries(probe.texts).some(([prefix, body]) => key.startsWith(prefix) && body.includes(key.slice(prefix.length))),
        )
    }).map((run) => ({ id: run.id, agentId: "agent-sale", context: {}, waitSince: run.since }))

const build = async () => {
    const agentRuns = mock<AgentRunsService>()
    agentRuns.parkedOfSubject.mockResolvedValue([])
    agentRuns.waitersOf.mockImplementation((_ws, filter) => Promise.resolve(waitersOf(filter)))
    const port = mock<GraphThreads>()
    port.stateOf.mockImplementation((ref) => {
        const run = RUNS.find((one) => one.id === ref.runId)
        return Promise.resolve(run === undefined ? null : ({ status: "stopped", stop: { question: run.park } } as unknown as ThreadView))
    })
    const runs = mock<ThreadRunsService>()
    runs.waitAnswered.mockResolvedValue({ kind: "admitted", fresh: true } as Awaited<ReturnType<ThreadRunsService["waitAnswered"]>>)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ThreadWaitsService,
            { provide: CLOCK, useValue: new FakeClock(new Date("2026-11-14T06:00:00.000Z")) },
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: ThreadRunsService, useValue: runs },
            { provide: AgentGraphFlowRunsService, useValue: mock<AgentGraphFlowRunsService>() },
            { provide: GRAPH_THREADS, useValue: port },
            { provide: AgentRunsService, useValue: agentRuns },
        ],
    }).compile()
    return { waits: moduleRef.get(ThreadWaitsService), runs, agentRuns, port }
}

/** A bank credit as the pipeline scope gives it: the provider's fields under `data`. */
const creditOf = (content: string) => ({ eventId: "tx-1", accountId: "acc-bank", data: { transactionId: "tx-1", amount: 250000, content } })

const turn = agentTurnViewOf({ workspaceId: "ws-1", agentId: "agent-sale", wakeId: "wake-credit", scopeKey: "key:data.transactionId=tx-1" })

describe("ThreadWaitsService: a wait matched by VALUE is found exactly, however many runs are parked (no page)", () => {
    it("the payment for the OLDEST of 60 order codes resumes ITS run, read from the credit's `data.content`", async () => {
        const { waits, runs } = await build()

        await expect(waits.took(turn, CREDIT, creditOf("CK dh1000 thanh toan"))).resolves.toBe(true)

        expect(runs.waitAnswered).toHaveBeenCalledTimes(1)
        expect(runs.waitAnswered).toHaveBeenCalledWith(
            { workspaceId: "ws-1", runId: "run-00" },
            "pay[r1].await",
            expect.objectContaining({ key: "paid" }),
            "wake-credit",
        )
    })

    it("asks only the runs whose keys the credit names: one checkpoint read, not one per parked run", async () => {
        const { waits, port } = await build()

        await waits.took(turn, CREDIT, creditOf("chuyen tien DH1042"))

        expect(port.stateOf.mock.calls.map(([ref]) => ref.runId)).toEqual(["run-42"])
    })

    it("a credit naming no parked order code is taken by no wait (it follows its own road)", async () => {
        const { waits, runs } = await build()

        await expect(waits.took(turn, CREDIT, creditOf("tien nha thang 11"))).resolves.toBe(false)
        expect(runs.waitAnswered).not.toHaveBeenCalled()
    })

    it("the person's line is found by the route its run parked with (a trigger with no test matches by subject)", async () => {
        const { waits, port } = await build()
        const line = { eventId: "m-1", routeId: "route-7", contactId: "contact-route-7", data: { text: "con hang khong" } }

        await expect(waits.took({ ...turn, scopeKey: "key:routeId=route-7" }, LINE, line)).resolves.toBe(true)
        expect(port.stateOf.mock.calls.map(([ref]) => ref.runId)).toEqual(["run-07"])
    })

    it("a run that took the event and HANDED IT BACK is never asked again: the event goes to the next waiter", async () => {
        const { waits, port } = await build()
        const handedBack = { ...turn, context: { ...turn.context, handedBackJson: JSON.stringify(["run-42"]) } }

        await expect(waits.took(handedBack, CREDIT, creditOf("chuyen tien DH1042"))).resolves.toBe(false)
        expect(port.stateOf).not.toHaveBeenCalled()
    })

    it("the same event through ANOTHER agent's wake of it finds the park taken by it, and ends taken (no second road)", async () => {
        const { waits, runs } = await build()
        runs.waitAnswered.mockResolvedValue({ kind: "refused" } as Awaited<ReturnType<ThreadRunsService["waitAnswered"]>>)
        runs.sameWaitKept.mockResolvedValue(true)

        await expect(waits.took({ ...turn, agentId: "agent-chatbot" }, CREDIT, creditOf("DH1003"))).resolves.toBe(true)
        expect(runs.sameWaitKept).toHaveBeenCalledWith({ workspaceId: "ws-1", runId: "run-03" }, "agent-sale", "pay[r1].await", "wake-credit", "tx-1")
    })

    it("the probe reads members by path, the same rule the test reads them by", () => {
        const probe = waitMatchProbeOf(CREDIT, creditOf("DH1000"))

        expect(Object.values(probe.texts)).toEqual(expect.arrayContaining(["DH1000", "dh1000"]))
        expect(waitMatchKeysOf(RUNS[0]?.park ?? paymentParkOf("x", "y")).length).toBeGreaterThan(0)
    })
})

describe("waitOfferOrder: the order one event is offered to the runs that may take it (engine-core rule 8)", () => {
    it("the run that started waiting LAST goes first", () => {
        expect(
            waitOfferOrder([
                { id: "run-a", callerRunId: null, waitSince: "2026-11-14T01:00:00.000Z" },
                { id: "run-b", callerRunId: null, waitSince: "2026-11-14T03:00:00.000Z" },
                { id: "run-c", callerRunId: null, waitSince: "2026-11-14T02:00:00.000Z" },
            ]),
        ).toEqual(["run-b", "run-c", "run-a"])
    })

    it("a child before its parent, even when the parent started waiting later; each run once", () => {
        expect(
            waitOfferOrder([
                { id: "parent", callerRunId: null, waitSince: "2026-11-14T05:00:00.000Z" },
                { id: "child", callerRunId: "parent", waitSince: "2026-11-14T01:00:00.000Z" },
                { id: "grandchild", callerRunId: "child", waitSince: "2026-11-14T00:30:00.000Z" },
                { id: "child", callerRunId: "parent", waitSince: null },
            ]),
        ).toEqual(["grandchild", "child", "parent"])
    })

    it("a run whose wait time is not known (found by its subject only) is asked after the ones that name one", () => {
        expect(
            waitOfferOrder([
                { id: "run-x", callerRunId: null, waitSince: null },
                { id: "run-y", callerRunId: null, waitSince: "2026-11-14T01:00:00.000Z" },
            ]),
        ).toEqual(["run-y", "run-x"])
    })
})
