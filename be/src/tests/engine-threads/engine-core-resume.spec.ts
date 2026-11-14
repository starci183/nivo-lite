import { GraphNodesError, GraphNodesErrorCode } from "@modules/domain/graph-nodes"
import { CORE_AGENT, CORE_EDGE, NOTE_READ, NOTE_WRITE } from "@tests/fixtures/builders/engine-core-plugin.builder"
import {
    CORE,
    FRONT,
    WS,
    button,
    customerWrites,
    founderDecides,
    ledgerOf,
    rowsOf,
    stopsOf,
    threadDbOf,
    type ThreadDb,
} from "./thread-world"
import { coreProcessOf, coreStarted, heldWakesOf, holdProvidersOf, noteActsOf, threadOf } from "./thread-world-core"

// ENGINE CORE: INTERRUPT + CHECKPOINT + RESUME ON THE SAME THREAD (frame `nivo-frame.engineCoreFirst` and `layers` (1): an edge is
// reported to /chat, the run freezes with the three decisions Thu lai / Tiep quan / Bo qua, and the next event resumes THAT thread), on
// the GENERIC fixture (`engine-core-plugin`, graph `tcore.edge`: write → check → second write → outcome). The checkpoint store is the
// in-memory store of the world behind the REAL `CheckpointSaverClient`: what is proved is the engine's use of the checkpointer interface
// (interrupt, resume, a process rebuilt from it), not the Postgres saver itself (its specs live in
// `be/src/modules/integrations/langgraph/persistence`).
jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const fixture: typeof import("@tests/fixtures/builders/engine-core-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/engine-core-plugin.builder",
    )
    return { installed: parts.installationWith([fixture.CORE_PLUGIN], "engine-core") }
})

/** The report of the AI core for a step it cannot complete: it stops for the founder. */
const report = {
    decision: "report",
    reason: "Ghi chu dang bi khoa.",
    question: "Lam gi tiep?",
    suggestions: [{ text: "Thu lai", handledBy: "workflow" }],
    customerLine: null,
}

/** The read of the check answers `blocked` first (the edge), then clear. */
const edgeOnce = (db: ThreadDb): void => {
    db.rights.answers?.set(NOTE_READ, [{ blocked: true }, { blocked: false }])
    db.model.script(CORE, report, report, report)
}

/** A database whose door answers the fixture's read from a script and keeps every tool call. */
const dbOf = (): ThreadDb => {
    const db = threadDbOf()
    return { ...db, rights: { ...db.rights, answers: new Map(), asked: [] } }
}

/** The calls of the check's read the door was asked. */
const readsOf = (db: ThreadDb) => (db.rights.asked ?? []).filter((one) => one.tool === NOTE_READ)

/** The edge graph stopped at its check: one write acted, nothing after the check. */
const stoppedAtCheck = async () => {
    const db = dbOf()
    edgeOnce(db)
    const process = await coreProcessOf(db)
    const runId = await coreStarted(process, CORE_EDGE)
    return { db, process, runId }
}

describe("an edge on a thread: ONE stop, the run waits, nothing after it runs", () => {
    it("ctx.fail({ kind: cannot }): one open stop on the check, one card, the first write once, the second never", async () => {
        const { db, process, runId } = await stoppedAtCheck()

        expect((await threadOf(process, runId)).status).toBe("stopped")
        expect((await stopsOf(process, runId)).map((stop) => [stop.stepKey, stop.state])).toEqual([["check", "open"]])
        expect(db.team).toHaveLength(1)
        const [stop] = await stopsOf(process, runId)
        expect(stop?.cardMessageId).toBe(db.team[0]?.id)
        expect(noteActsOf(db).map((act) => act.payload.text)).toEqual(["goi lai cho khach"])
        expect(Object.keys((await threadOf(process, runId)).steps)).toEqual(["first"])
        expect(rowsOf(db, runId).run).toMatchObject({ engine: "langgraph", status: "waiting" })
    })

    it("the card offers the three decisions (Th\u1eed l\u1ea1i / Ti\u1ebfp qu\u1ea3n / B\u1ecf qua)", async () => {
        const { db } = await stoppedAtCheck()
        const posted = db.team[0]?.versions[0] ?? {}

        expect(posted).toMatchObject({ kind: "workflow.stopped" })
        expect(posted).toMatchObject({ card: { decisions: ["retry", "take_over", "skip"], stop: { needs: { answer: true } } } })
    })

    it("a tool's infrastructure refusal (not connected) is an edge too: one stop on the step, nothing after it", async () => {
        const db = dbOf()
        db.rights.answers?.set(NOTE_READ, [
            new GraphNodesError({ code: GraphNodesErrorCode.ToolNotConnected, params: { tool: NOTE_READ } }),
            { blocked: false },
        ])
        db.model.script(CORE, report, report)
        const process = await coreProcessOf(db)
        const runId = await coreStarted(process, CORE_EDGE)

        expect((await threadOf(process, runId)).status).toBe("stopped")
        expect((await stopsOf(process, runId)).map((stop) => stop.stepKey)).toEqual(["check"])
        expect(noteActsOf(db)).toHaveLength(1)

        await founderDecides(process, runId, button(db, "retry"))
        expect((await threadOf(process, runId)).status).toBe("ended")
        expect(noteActsOf(db)).toHaveLength(2)
    })

    it("an engine failure (the write's executor throws) is an edge on THAT step: the retry acts it, the first write stays once", async () => {
        const db = dbOf()
        db.rights.answers?.set(NOTE_READ, [{ blocked: false }])
        db.model.script(CORE, report, report)
        db.throwOn.set(NOTE_WRITE, new Error("executor down"))
        const process = await coreProcessOf(db)
        const runId = await coreStarted(process, CORE_EDGE)

        expect((await threadOf(process, runId)).status).toBe("stopped")
        expect((await stopsOf(process, runId)).map((stop) => stop.stepKey)).toEqual(["first"])

        await founderDecides(process, runId, button(db, "retry"))
        expect((await threadOf(process, runId)).status).toBe("ended")
        // The failed act and the retried one reached the outside; the ledger keeps the one that answered.
        expect(noteActsOf(db).filter((act) => act.payload.text !== "second")).toHaveLength(2)
        expect(ledgerOf(db).filter((row) => row.effectId === NOTE_WRITE)).toHaveLength(2)
    })
})

describe("the three decisions on the same thread", () => {
    it("Th\u1eed l\u1ea1i re-runs ONLY the failed node: the done write answers from the ledger, the read runs again, run.at is kept", async () => {
        const { db, process, runId } = await stoppedAtCheck()
        const instants = () =>
            ledgerOf(db)
                .filter((row) => row.effectId === "engine.step-instant")
                .map((row): readonly [string, unknown] => [String(row.effectKey), row.subjectId])
        // The steps that ran before the stop (the done write, the check) each kept their instant; `second` first runs after the retry.
        const before = instants()

        await founderDecides(process, runId, button(db, "retry"))

        const thread = await threadOf(process, runId)
        expect(thread.status).toBe("ended")
        expect(noteActsOf(db).map((act) => act.payload.text)).toEqual(["goi lai cho khach", "second"])
        expect(readsOf(db)).toHaveLength(2)
        expect(new Set(readsOf(db).map((one) => one.key)).size).toBe(1)
        // The re-run check writes NO new instant: every instant kept before the retry is kept as it was, and only `second` adds its own.
        expect(instants().filter(([key]) => !key.includes(":second:"))).toEqual(before)
        expect(instants().filter(([key]) => key.includes(":check:"))).toHaveLength(1)
        const at = instants().find(([key]) => key.includes(":check:"))?.[1]
        expect(thread.steps).toMatchObject({ check: { output: { checked: true, at } }, end: { output: { outcome: "end" } } })
        expect((await stopsOf(process, runId))[0]).toMatchObject({ state: "resolved", answers: [{ kind: "retry", text: null }] })
    })

    it("B\u1ecf qua ends the run where it is: the stop resolves, nothing after the check runs", async () => {
        const { db, process, runId } = await stoppedAtCheck()

        await founderDecides(process, runId, button(db, "skip"))

        expect((await threadOf(process, runId)).status).toBe("ended")
        expect(noteActsOf(db)).toHaveLength(1)
        expect((await stopsOf(process, runId))[0]).toMatchObject({ state: "resolved", decision: { kind: "skip" } })
        expect(rowsOf(db, runId).run).toMatchObject({ status: "cancelled" })
    })

    it("Ti\u1ebfp qu\u1ea3n keeps the thread at its gate, the run waits as taken over; a later Th\u1eed l\u1ea1i still continues THAT thread", async () => {
        const { db, process, runId } = await stoppedAtCheck()

        await founderDecides(process, runId, button(db, "take_over"))
        expect((await threadOf(process, runId)).status).toBe("stopped")
        expect((await stopsOf(process, runId))[0]).toMatchObject({ state: "open" })
        expect(rowsOf(db, runId).run).toMatchObject({ status: "waiting", error: { code: "taken_over" } })
        expect(noteActsOf(db)).toHaveLength(1)

        await founderDecides(process, runId, button(db, "retry"))
        expect((await threadOf(process, runId)).status).toBe("ended")
        expect(noteActsOf(db)).toHaveLength(2)
    })
})

describe("a process rebuilt from the checkpoint while the run waits", () => {
    it("keeps the stop and resumes the same thread: the done write is not acted again, the second write once", async () => {
        const { db, runId } = await stoppedAtCheck()
        const rebuilt = await coreProcessOf(db)

        expect((await threadOf(rebuilt, runId)).status).toBe("stopped")
        expect((await stopsOf(rebuilt, runId)).map((stop) => [stop.stepKey, stop.state])).toEqual([["check", "open"]])

        await founderDecides(rebuilt, runId, button(db, "retry"))
        expect((await threadOf(rebuilt, runId)).status).toBe("ended")
        expect(noteActsOf(db).map((act) => act.payload.text)).toEqual(["goi lai cho khach", "second"])
        expect(ledgerOf(db).filter((row) => row.effectId === NOTE_WRITE)).toHaveLength(2)
    })
})

describe("the next event for the same subject while its run waits at a stop (frame: it resumes THAT thread)", () => {
    /** The inbox graph (the agent's primary, woken by a line of the conversation) stopped at its check by the first line. */
    const inboxStopped = async () => {
        const db0 = threadDbOf({ modules: { [FRONT]: CORE_AGENT } })
        const db: ThreadDb = { ...db0, rights: { ...db0.rights, answers: new Map(), asked: [] } }
        edgeOnce(db)
        const process = await coreProcessOf(db, { extra: holdProvidersOf(db) })
        const first = await customerWrites(process, "Ghi chu giup em")
        expect(first.error).toBeNull()
        const runId = first.runId ?? ""
        expect((await threadOf(process, runId)).status).toBe("stopped")
        return { db, process, runId }
    }

    it("opens NO second run while the stop stands", async () => {
        const { db, process, runId } = await inboxStopped()

        const second = await customerWrites(process, "Them dong nay nua")

        expect(second.error).toBeNull()
        expect([...db.runs.keys()]).toEqual([runId])
        // Rule Q-1: the second line waits as a held wake behind the stopped run, and starts nothing.
        expect(heldWakesOf(db).map((wake) => wake.reason)).toEqual([`waiting:${runId}`])
    })

    // RULE Q-1 (QB-HOLD-SPECS): FAILS TODAY, a suspected source bug: a Retry carries no words, so `turn.founderAnswers` stays empty, the queue visit
    // stays 0 (`agent-graph-run-queue.service.ts`, `visit = founderAnswers.length`) and the wake held behind the run is never taken by the re-run:
    // it is released pending when the run ends and starts a SECOND run (the line never reaches this run).
    it("after Th\u1eed l\u1ea1i the second event is part of THAT thread: still one run, and its line reaches the resumed run", async () => {
        const { db, process, runId } = await inboxStopped()
        await customerWrites(process, "Them dong nay nua")

        await founderDecides(process, runId, button(db, "retry"))

        expect((await threadOf(process, runId)).status).toBe("ended")
        expect([...db.runs.keys()]).toEqual([runId])
        expect(noteActsOf(db).map((act) => act.payload.text)).toContain("zalo:m-2")  // the inbox node writes each event's message key (the words are the engine's own line, R26)
    })

    it("the workspace of every act is the run's, before and after the rebuild", async () => {
        const { db, runId } = await inboxStopped()
        const rebuilt = await coreProcessOf(db, { extra: holdProvidersOf(db) })
        await founderDecides(rebuilt, runId, button(db, "retry"))

        expect(noteActsOf(db).every((act) => act.workspaceId === WS)).toBe(true)
    })
})
