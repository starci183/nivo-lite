import { CORE_MOVE_AUTO, CORE_WRITE_AUTO, MONEY_MOVE, NOTE_WRITE } from "@tests/fixtures/builders/engine-core-plugin.builder"
import { WS, drain, stopsOf, threadDbOf, type ThreadDb, type ThreadProcess } from "./thread-world"
import { coreProcessOf, coreStarted, noteActsOf, threadOf } from "./thread-world-core"

jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const fixture: typeof import("@tests/fixtures/builders/engine-core-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/engine-core-plugin.builder",
    )
    return { installed: parts.installationWith([fixture.CORE_PLUGIN], "engine-core") }
})

// QUEUE-BUILD rule Q-2 (R71/R73/R80/R81), the second kind of workflow (R75): a plain write step, no customer and no channel. A failure
// the ONE classifier calls transient (a connection refused before anything left) parks the run on the step and the engine runs it again
// after 1, 2, 4, 8 minutes; after the 4th retry it is ONE ordinary stop. A write whose outcome is unknown and whose tool does not declare
// itself `repeatable` stops at once: no park, no retry (forward only). The customer-line kind is `send-outcome-unknown.spec.ts`.

/** A failure that left nothing outside, as the network names it (classified `transient`). */
const refusedConnection = (): Error => Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })

/** The thread's park question, when it is parked on a retry of `step`. */
const parkOf = async (process: ThreadProcess, runId: string): Promise<Record<string, unknown> | null> => {
    const view = await process.threads.stateOf({ workspaceId: WS, runId })
    const question: unknown = view?.status === "stopped" ? view.stop?.question : null
    return typeof question === "object" && question !== null ? { ...question } : null
}

/** The timer of the retry the thread is parked on, fired after its pause (the deadline job's REAL road), then the wakes drained. */
const retried = async (db: ThreadDb, process: ThreadProcess, runId: string): Promise<void> => {
    const park = await parkOf(process, runId)
    const round = Number(park?.round)
    db.clock.advance(9 * 60_000)
    const payload = { workspaceId: WS, runId, stepKey: String(park?.parkKey), repeats: round, answered: -1 }
    const from = db.wakes.length
    await expect(process.deadlines?.fire(payload)).resolves.toBe("admitted")
    await drain(process, from)
}

describe("rule Q-2: a transient failure parks the step and runs it again by itself, bounded", () => {
    it("ECONNREFUSED on the write: parked (no stop, no card), the timer runs the step again, the write acts once, the run ends", async () => {
        const db = threadDbOf()
        db.throwOn.set(NOTE_WRITE, refusedConnection())
        const process = await coreProcessOf(db)
        const runId = await coreStarted(process, CORE_WRITE_AUTO)

        expect(await parkOf(process, runId)).toMatchObject({ kind: "until_round", loopKey: "retry:write", round: 1, parkKey: "retry:write[r1]" })
        expect(await stopsOf(process, runId)).toEqual([])
        expect(db.runs.get(runId)?.status).toBe("running")

        await retried(db, process, runId)

        expect((await threadOf(process, runId)).status).toBe("ended")
        expect(await stopsOf(process, runId)).toEqual([])
        // The failed try reached the executor and threw before anything was kept; the retry acted once.
        expect(noteActsOf(db).filter((act) => act.effect === NOTE_WRITE)).toHaveLength(2)
    })

    it("still failing after 4 retries (1, 2, 4, 8 min): ONE ordinary stop for a person, with the retries as a fact; never a 5th retry", async () => {
        const db = threadDbOf()
        db.throwOn.set(NOTE_WRITE, refusedConnection())
        db.model.script("engine:step-trouble", {
            decision: "report",
            reason: "Ghi chu khong luu duoc.",
            question: null,
            suggestions: [
                { text: "Thu lai", handledBy: "workflow" },
                { text: "Bo qua", handledBy: "person" },
            ],
            customerLine: null,
        })
        const process = await coreProcessOf(db)
        const runId = await coreStarted(process, CORE_WRITE_AUTO)
        for (const attempt of [1, 2, 3, 4]) {
            expect(await parkOf(process, runId)).toMatchObject({ round: attempt })
            db.throwOn.set(NOTE_WRITE, refusedConnection())
            await retried(db, process, runId)
        }

        const stops = await stopsOf(process, runId)
        expect(stops).toHaveLength(1)
        expect(stops[0]).toMatchObject({ stepKey: "write", state: "open" })
        expect(Object.fromEntries((stops[0]?.detail.facts ?? []).map((fact) => [fact.name, fact.value]))).toMatchObject({ retries: "4" })
        expect(noteActsOf(db).filter((act) => act.effect === NOTE_WRITE)).toHaveLength(5)
    })
})

describe("rule Q-2: an unknown outcome of a write that is not repeatable stops at once (forward only)", () => {
    it("the money write answers outcome unknown: ONE stop at once, no park, no retry, the ledger keeps the unknown", async () => {
        const db = threadDbOf()
        db.throwOn.set(MONEY_MOVE, Object.assign(new Error("sent, no answer"), { code: "tool_outcome_unknown" }))
        const process = await coreProcessOf(db)
        const runId = await coreStarted(process, CORE_MOVE_AUTO)

        const stops = await stopsOf(process, runId)
        expect(stops).toHaveLength(1)
        expect(stops[0]).toMatchObject({ stepKey: "write", state: "open" })
        expect(await parkOf(process, runId)).not.toMatchObject({ kind: "until_round" })
        expect(noteActsOf(db).filter((act) => act.effect === MONEY_MOVE)).toHaveLength(1)
    })
})
