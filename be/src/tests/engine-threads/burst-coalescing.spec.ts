import { AgentGraphRunQueueService } from "@modules/domain/agent-graphs/agent-graph-run-queue.service"
import { AGENT_NODE_EFFECTS, AGENT_RUNS } from "@tests/fixtures/builders/engine-core-tables.builder"
import { holdProvidersOf } from "./thread-world-core"
import { UNDERSTAND, customersSay, processOf, runTurns, threadDbOf, type ThreadProcess } from "./thread-world"

// WORLD (a) of the backlog: a burst of customer lines is ONE run (coordinator ruling 3 of the one event pipeline, final rule: one run per
// (graph, subject); events that arrive for a subject are stored rows; the run that starts takes the WHOLE list: the oldest is its trigger
// scope, the rest are `run.queue`). THE TWO HALVES:
//
//  - PROVED HERE: the customer lines come in through the real Zalo entry (the body kept once, the provider's pure `translate`, the REAL
//    `ProviderTriggersService.deliver`: contact met, route ensured, the registration asked, one wake per line). The settle time is the one
//    the Zalo declaration declares (`ZALO_MESSAGE_TRIGGER.settle`: 6 s window, 20 s at most), stamped on each wake by the REAL `burstFor`.
//    The oldest wake begins ONE run; the REAL run queue takes the later wakes of the same lock scope on the run's first step visit, as a
//    snapshot kept once in the effect ledger (`queue:<run>:<step>:<visit>`); a line of another route is another scope and its own run.
//  - NOT PROVED HERE (a memory world has no database clock and no `agent_wakes` table): that `agent_turn_begin` itself waits the sliding
//    settle window before it begins the oldest wake and stops at the cap. That is the migration
//    `db/migrations/20261114000000_burst-merge-lines.sql` and `be/src/tests/integration/agent-work/agent-work-store.integration-spec.ts`
//    (written, NOT run by this lane: it needs a database). The old merge model (`mergedLinesJson`, `isStart`, a barrier at a `/start`) is gone
//    with the design; a `/start` is an ordinary line now (Opus-2), the hand-back is world (l).

/** A customer other than the world's default one: a Zalo user id is digits. */
const OTHER = "8800110033"

/** A moment of the channel, in the order the customer sent the lines: one second apart. */
const SENT = Date.parse("2026-11-10T10:00:00.000Z")
const at = (second: number): Date => new Date(SENT + second * 1000)

/** The queue snapshots the run kept, by ledger key. */
const snapshotsOf = (db: ThreadProcess["db"], runId: string): ReadonlyArray<{ key: string; events: ReadonlyArray<{ wakeId: string; scope: Record<string, unknown> }> }> =>
    db.records
        .of(AGENT_NODE_EFFECTS, { runId })
        .filter((row) => String(row.data.effectKey).startsWith(`queue:${runId}:`))
        .map((row) => ({
            key: String(row.data.effectKey),
            events: ((row.data.args as { events?: Array<{ wakeId: string; scope: Record<string, unknown> }> } | null)?.events ?? []),
        }))

/** The step keys of a run, in order. */
const stepsOf = async (process: ThreadProcess, runId: string): Promise<ReadonlyArray<string>> => {
    const view = await process.threads.stateOf({ workspaceId: process.db.records.get(AGENT_RUNS, runId)?.workspaceId ?? "", runId })
    return Object.keys(view?.state.steps ?? {})
}

/** The `buy` branch of the front desk: it hands on to Sales and tells the customer nothing (the walk's shortest route). */
const buy = (db: ThreadProcess["db"], times = 1): void => {
    for (let one = 0; one < times; one += 1) db.model.script(UNDERSTAND, { done: { branch: "buy", summary: "Lan: buy" } })
}

describe("burst: three lines one second apart on one route are ONE run (the oldest is the trigger, the rest are `run.queue`)", () => {
    it("one run for three lines; the later wakes begin nothing; the run's first visit takes them in order, once", async () => {
        const db = threadDbOf()
        buy(db)
        const process = await processOf(db, { extra: [...holdProvidersOf(db), AgentGraphRunQueueService] })

        const wakes = await customersSay(process, [
            { text: "Shop oi", key: "m-b1", at: at(0) },
            { text: "cho minh dat hoa", key: "m-b2", at: at(1) },
            { text: "mot bo hong do nhe", key: "m-b3", at: at(2) },
        ])
        expect(wakes).toHaveLength(3)
        // One lock scope for the person; the wake door stamped the settle time the Zalo declaration declares on every one of them.
        expect(new Set(wakes.map((wake) => wake.scopeKey)).size).toBe(1)
        expect(wakes.map((wake) => wake.burst)).toEqual(Array(3).fill({ windowMs: 6000, maxWaitMs: 20_000 }))

        const woken = await runTurns(process, wakes)

        // ONE run; the two later wakes ran no run of their own: the run's queue took them.
        expect(woken).toHaveLength(1)
        expect(woken[0]?.error).toBeNull()
        expect(woken[0]?.ending).toMatchObject({ status: "done" })
        expect([...db.runs.keys()]).toHaveLength(1)
        const runId = woken[0]?.runId ?? ""
        expect(wakes.map((wake) => wake.state)).toEqual(["begun", "queued", "queued"])
        expect(wakes.map((wake) => wake.reason ?? null)).toEqual([null, `queued:${runId}`, `queued:${runId}`])

        // The FIRST step visit of the run took both, oldest first, as ONE snapshot kept once (a re-run of the step reads the same events);
        // no later visit takes anything. (The chat flow of the world starts at `hear`.)
        const [first, ...rest] = snapshotsOf(db, runId)
        expect((await stepsOf(process, runId))[0]).toBe("hear")
        expect(first?.key).toBe(`queue:${runId}:hear:0`)
        expect(first?.events.map((event) => event.wakeId)).toEqual([wakes[1]?.id, wakes[2]?.id])
        expect(first?.events.map((event) => (event.scope.data as { text?: string } | undefined)?.text)).toEqual(["cho minh dat hoa", "mot bo hong do nhe"])
        expect(rest.flatMap((one) => one.events)).toEqual([])
    })

    it("a line of ANOTHER route in the same window is its own run: another lock scope, never queued on the first person's run", async () => {
        const db = threadDbOf()
        buy(db, 2)
        const process = await processOf(db, { extra: [...holdProvidersOf(db), AgentGraphRunQueueService] })

        const wakes = await customersSay(process, [
            { text: "Shop oi", key: "m-c1", at: at(0) },
            { text: "Em la khach moi", key: "m-o1", userId: OTHER, visitor: "Mai", at: at(1) },
            { text: "cho minh dat hoa", key: "m-c2", at: at(2) },
        ])
        expect(new Set(wakes.map((wake) => wake.scopeKey)).size).toBe(2)

        const woken = await runTurns(process, wakes)

        expect(woken.map((one) => one.error)).toEqual([null, null])
        expect([...db.runs.keys()]).toHaveLength(2)
        const [mine, other] = woken
        expect(snapshotsOf(db, mine?.runId ?? "").flatMap((one) => one.events.map((event) => event.wakeId))).toEqual([wakes[2]?.id])
        expect(snapshotsOf(db, other?.runId ?? "").flatMap((one) => one.events)).toEqual([])
        expect(wakes.map((wake) => wake.state)).toEqual(["begun", "begun", "queued"])
    })

    it("the same line delivered twice is one wake and one run (the account keeps the event once)", async () => {
        const db = threadDbOf()
        buy(db)
        const process = await processOf(db, { extra: [...holdProvidersOf(db), AgentGraphRunQueueService] })

        const first = await customersSay(process, [{ text: "Shop oi", key: "m-d1", at: at(0) }])
        const again = await customersSay(process, [{ text: "Shop oi", key: "m-d1", at: at(0) }])

        expect(first).toHaveLength(1)
        expect(again).toEqual([])
        const woken = await runTurns(process, first)
        expect(woken).toHaveLength(1)
        expect([...db.runs.keys()]).toHaveLength(1)
    })
})
