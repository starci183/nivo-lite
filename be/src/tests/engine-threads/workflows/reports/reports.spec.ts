import { TOOL } from "@nivo-lite/blocks-core"
import { actsOf, redrive, rowsOf, stopsOf, type ThreadProcess } from "../../thread-world"
import { WS } from "../../thread-world-records"
import {
    W8P,
    closeWake,
    confusedAnswer,
    diesAtDone,
    threadStatusOf,
    threadStepsOf,
    w8OutcomeOf,
    w8ProcessOf,
    w8Wake,
} from "../../thread-world-w8-wakes"
import { calls, linesOf, moneyDbOf, type MoneyDb } from "../reconcile/thread-world-money"
import { moneyProcessOf } from "../reconcile/thread-world-money-process"
import baseline from "./reports.baseline.json"

// Package W8 (design row 2-3): `accounting.reports` (report → reported) on a LangGraph thread, woken by the evening close of the
// accounting agent's schedule. The `report` step is a SIDE step (`blocking: false`): it never stops a thread (a failure is passed
// over with one notice to the founder), so its "stop" spec proves exactly that, and that there is nothing for a founder's answer to resume.
// The twin walk's old half is a fixed baseline now (the old engine's walk, which this twin held equal to the thread at tree aa40f9655; old half removed in phase 3, package X1).

/** 2026-11-09 21:00 Vietnam: the evening close of the shop day 2026-11-09. */
const SLOT = Date.parse("2026-11-09T14:00:00.000Z")
const DAY = "2026-11-09"
const PATH = ["report", "reported"]

const closes = (db: MoneyDb) =>
    db.model.script(W8P.dailyClose, calls(TOOL.reportDailyClose, { day: DAY }), { done: { day: DAY, posted: true } })

const started = async (script: (db: MoneyDb) => void) => {
    const process = await w8ProcessOf({}, script)
    const woken = await w8Wake(process, closeWake(SLOT))
    expect(woken.error).toBeNull()
    return { process, db: process.db, runId: woken.runId ?? "" }
}

const resumeRefused = async (process: ThreadProcess, runId: string, db: MoneyDb) =>
    process.threadRuns.resume(
        { workspaceId: WS, runId },
        { kind: "answer", text: "Lam lai di", by: "owner-1", at: db.clock.now().toISOString() },
    )

describe("reports on a thread against the old engine's baseline", () => {
    it("report → reported: one close of the day, the old engine's steps, acts, ledger and model calls; nothing to a customer", async () => {
        const old = baseline
        const thread = await started(closes)

        expect(await threadStatusOf(thread.process, thread.runId)).toBe("ended")
        expect(await threadStepsOf(thread.process, thread.runId)).toEqual(PATH)
        expect(w8OutcomeOf(thread.db)).toEqual(old.outcome)
        expect(actsOf(thread.db, TOOL.reportDailyClose).map((act) => act.payload)).toEqual([{ day: DAY }])
        // The agent was given the shop day of the slot, not a figure.
        expect(JSON.stringify(thread.db.model.askedOf(W8P.dailyClose)[0]?.request)).toContain(DAY)
        expect(linesOf(thread.db)).toEqual([])
        // A thread adds no model call: 2 on the old engine.
        expect(thread.db.model.asked.length).toBe(old.asked)
        expect(rowsOf(thread.db, thread.runId).run).toMatchObject({ engine: "langgraph", status: "done" })
    })
})

describe("reports on a thread: a side step never stops", () => {
    it("the close cannot complete: passed over, no stop record, no AI core, one notice to the founder, the run ends", async () => {
        const { process, db, runId } = await started((one) =>
            one.model.script(W8P.dailyClose, confusedAnswer("Khong doc duoc so sach", "Dong so the nao?")),
        )

        expect(await threadStatusOf(process, runId)).toBe("ended")
        expect(await threadStepsOf(process, runId)).toEqual(PATH)
        expect(await stopsOf(process, runId)).toEqual([])
        expect(db.records.of("agent.run-stop", { runId })).toEqual([])
        expect(db.model.askedOf(W8P.core)).toEqual([])
        expect(db.team.map((message) => message.key)).toEqual([`side-passed:${runId}:report`])
        expect(actsOf(db, TOOL.reportDailyClose)).toEqual([])
        expect(linesOf(db)).toEqual([])
        // Nothing waits for a founder: an answer has no stop to resume.
        expect((await resumeRefused(process, runId, db)).kind).not.toBe("admitted")
    })
})

describe("reports on a thread: killed and replayed", () => {
    it("killed after the close acted (its checkpoint not written): a new process goes on; ONE close of the day", async () => {
        const db = moneyDbOf({})
        closes(db)
        diesAtDone(db, 1)
        const first = await moneyProcessOf(db)
        const woken = await w8Wake(first, closeWake(SLOT))
        expect(String(woken.error)).toContain("WORLD_PROCESS_DIED")
        const runId = woken.runId ?? ""
        expect(actsOf(db, TOOL.reportDailyClose)).toHaveLength(1)

        closes(db)
        const second = await moneyProcessOf(db)
        const ran = await redrive(second, runId, "sweep-1")

        expect(ran.map((one) => one.error)).toEqual([null])
        expect(await threadStatusOf(second, runId)).toBe("ended")
        expect(await threadStepsOf(second, runId)).toEqual(PATH)
        expect(actsOf(db, TOOL.reportDailyClose)).toHaveLength(1)
        expect(rowsOf(db, runId).run).toMatchObject({ status: "done" })
    })
})
