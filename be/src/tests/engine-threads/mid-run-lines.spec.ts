import { AgentGraphRunQueueService } from "@modules/domain/agent-graphs/agent-graph-run-queue.service"
import { AGENT_NODE_EFFECTS } from "@tests/fixtures/builders/engine-core-tables.builder"
import { holdProvidersOf } from "./thread-world-core"
import { UNDERSTAND, customersSay, processOf, runHeard, runTurns, threadDbOf } from "./thread-world"

// WORLD (b) of the backlog (final rule: ONE run in flight per (graph, subject)): a line that arrives while the person's run is MID-WAY (the
// model is inside its step) is never pushed into the started run. Its wake is HELD behind the run (`waiting:<run>`, the flow's
// `inFlightBehind`), no second run opens, and when the run has ENDED the engine offers the held wakes again (`releaseWaiting`): the NEXT run
// starts on the oldest of them and its first visit takes the whole rest of the list as `run.queue`, oldest first, once.
// Real: the Zalo entry, `deliver`, the flow's in-flight guard over the real run store, the thread engine, the real run queue. Doubles: the model
// (paused with `hold`), the wake table. NOT proved: the partial unique index that refuses a second in-flight run at the database (database-only).

const buy = (db: ReturnType<typeof threadDbOf>, times: number): void => {
    for (let one = 0; one < times; one += 1) db.model.script(UNDERSTAND, { done: { branch: "buy", summary: "Lan: buy" } })
}

describe("a line arriving while the run is mid-way waits, and the next run takes the whole list", () => {
    it("two lines during the run are held behind it, open no run, and start ONE next run that takes the second as its queue", async () => {
        const db = threadDbOf()
        buy(db, 2)
        const process = await processOf(db, { extra: [...holdProvidersOf(db), AgentGraphRunQueueService] })
        const paused = db.model.hold(UNDERSTAND)

        const first = await customersSay(process, [{ text: "Shop oi", key: "m-mid-1" }])
        const running = runHeard(process, first)
        await paused.entered
        const firstRun = [...db.runs.keys()][0] ?? ""
        expect(firstRun).not.toBe("")

        // Two more lines while the first run is inside its step: each wake is held behind it; no second run exists.
        const midway = await customersSay(process, [
            { text: "cho minh dat hoa", key: "m-mid-2" },
            { text: "mot bo hong do nhe", key: "m-mid-3" },
        ])
        const held = [await runHeard(process, midway), await runHeard(process, midway)]
        expect(held.map((one) => one.ending)).toEqual([
            { status: "held", reason: `waiting:${firstRun}`, outcome: null },
            { status: "held", reason: `waiting:${firstRun}`, outcome: null },
        ])
        expect([...db.runs.keys()]).toEqual([firstRun])

        paused.release()
        expect((await running).error).toBeNull()

        // The run has ended: the held wakes are offered again, oldest first; ONE next run takes the whole list.
        expect(midway.map((wake) => wake.state)).toEqual(["pending", "pending"])
        const next = await runHeard(process, midway)
        expect(next.error).toBeNull()
        const secondRun = next.runId ?? ""
        expect(secondRun).not.toBe(firstRun)
        expect([...db.runs.keys()]).toEqual([firstRun, secondRun])
        expect(midway.map((wake) => wake.state)).toEqual(["begun", "queued"])
        const taken = db.records
            .of(AGENT_NODE_EFFECTS, { runId: secondRun })
            .filter((row) => String(row.data.effectKey).startsWith(`queue:${secondRun}:`))
            .flatMap((row) => ((row.data.args as { events?: Array<{ wakeId: string }> } | null)?.events ?? []).map((event) => event.wakeId))
        expect(taken).toEqual([midway[1]?.id])
    })

    // WORLD (j): a process restart loses no waiting event. The wakes the delivery wrote (and the held ones) are rows of the database; a NEW
    // process over the same database finds them, so the lines delivered before the restart are handled exactly once.
    it("lines delivered before a restart are all found by the next process: one run, the later line in its queue, none lost or doubled", async () => {
        const db = threadDbOf()
        buy(db, 1)
        const before = await processOf(db, { extra: [...holdProvidersOf(db), AgentGraphRunQueueService] })
        const wakes = await customersSay(before, [
            { text: "Shop oi", key: "m-restart-1" },
            { text: "cho minh dat hoa", key: "m-restart-2" },
        ])
        expect(wakes.map((wake) => wake.state)).toEqual(["pending", "pending"])

        // The process dies here: nothing ran. A new one is built over the same stores.
        const after = await processOf(db, { extra: [...holdProvidersOf(db), AgentGraphRunQueueService] })
        const woken = await runTurns(after, wakes)

        expect(woken).toHaveLength(1)
        expect(woken[0]?.error).toBeNull()
        expect(wakes.map((wake) => wake.state)).toEqual(["begun", "queued"])
        expect([...db.runs.keys()]).toHaveLength(1)
        // The same lines delivered again (the webhook retried after the restart) change nothing.
        expect(await customersSay(after, [{ text: "Shop oi", key: "m-restart-1" }])).toEqual([])
    })
})
