import { mock, mockEntityManager } from "@starci/jest-preset"
import type { Logger } from "@modules/platform/logging"
import type { AgentWakeService } from "@modules/domain/agent-work"
import type { AgentRunsService } from "@modules/domain/agent-runs"
import { ErasedContactRunsAdapter } from "@modules/domain/agent-threads/erased-contact-runs.adapter"
import { ErasedSubjectRunsService } from "@modules/domain/agent-threads/erased-subject-runs.service"
import { DeliveredWakesService } from "@modules/domain/provider-triggers"
import { AGENT_RUNS } from "@tests/fixtures/builders/engine-core-tables.builder"
import { CONTACT, CONV, customersSay, drain, handedBack, runTurns } from "../../thread-world"
import { chatServicesOf, wakeQueueOf } from "../../thread-world-intake"
import { subjectRunReadsOf } from "../../thread-world-process"
import { WS } from "../../thread-world-records"
import { FIRST_ROUND, SALE_TRUTHS, SP, handedToConsult, parkedSaleOf, saidOf, salesWorldOf } from "./thread-world-sales"
import { threadStepsOf } from "../../thread-world-w8-wakes"

// EDGES OF THE ONE-RUN SALE (MATRIX scope sales + chatbot, R40/R42).
//
// R37 (coordinator, on owner ruling R31): erasing a contact ENDS the runs parked on it or on its routes. The REAL `ErasedContactRunsAdapter`
// (what `ContactsService.delete` calls) reads the person's routes from the route store and the REAL `ErasedSubjectRunsService` ends, through the
// REAL run store, every thread run of any agent parked on one of those subjects as `cancelled` with the typed reason `subject_erased`; its wait
// mark and deadline are cleared, so no event finds it and the one-run-per-subject slot is free. No stop card, nobody is told. Doubles: the wake
// table the held wakes are dropped from, the model.

// (This world was RED ON PURPOSE until the erasure selected the runs parked at a `wait`: row status `running` + `wait_match`, not only `waiting`; fixed by
// the engine on 2026-11-14, green since.)
describe("R37: erasing a contact ends the sale parked on their route", () => {
    it("the parked sale run is cancelled `subject_erased`, its wait mark is cleared, and a second erasure ends nothing", async () => {
        const { db, saleRun } = await parkedSaleOf()
        // A run parked at a `wait` is row status `running` with its wait mark (only a STOP writes `waiting`: thread-projection `runValuesOfStep`).
        expect(db.records.get(AGENT_RUNS, saleRun)?.data).toMatchObject({ status: "running" })
        expect(db.records.get(AGENT_RUNS, saleRun)?.data.waitMatch).not.toEqual(null)
        const wakes = new DeliveredWakesService(mock<AgentWakeService>({ ...wakeQueueOf(db.chat) }))
        const runs = subjectRunReadsOf(db)
        const adapter = new ErasedContactRunsAdapter(
            new ErasedSubjectRunsService(mock<AgentRunsService>({ endParkedOfSubjects: runs.endParkedOfSubjects }), wakes, mock<Logger>()),
            db.chat.routes,
        )

        await expect(adapter.erasing(mockEntityManager(), WS, [CONTACT])).resolves.toBe(1)

        expect(db.records.get(AGENT_RUNS, saleRun)?.data).toMatchObject({ status: "cancelled", error: { code: "subject_erased" } })
        expect(db.records.get(AGENT_RUNS, saleRun)?.data.waitMatch ?? null).toBeNull()
        // No card, no notice: nobody is told, no stop exists for it.
        expect(db.team).toEqual([])
        expect(db.records.of("run_stops")).toEqual([])
        await expect(adapter.erasing(mockEntityManager(), WS, [CONTACT])).resolves.toBe(0)
    })
})

// STAFF HOLD (R43 + R45 item 1): a member of the shop took the ROUTE over (the engine's `hold`, not a chat field). A held route costs no AI work:
// the person's line is KEPT as always (the engine's conversation store) but is NOT correlated: no run starts and no wait wakes, so the parked sale
// takes nothing, answers nothing and the send door is never reached. Handing back (the release door: clear the hold, THEN one resume event
// through `deliver`) is a delivery like any other: the parked wait claims it, and the agent, resumed, reads the thread since and answers.
describe("R45: while staff hold the route a line is kept but starts no run and wakes no wait", () => {
    it("the line is kept, no wake is made, the parked sale run is untouched and nothing is said to the person", async () => {
        const { db, process, saleRun } = await parkedSaleOf()
        await chatServicesOf(db).routes.hold(WS, CONV, "member-1")
        const said = saidOf(db).length
        const wakesBefore = db.wakes.length
        const ledgerBefore = db.chat.ledger.rows.length

        const wakes = await customersSay(process, [{ text: "them 1 gio nua nhe shop", key: "m-held-1" }])
        const ended = await runTurns(process, wakes)

        expect(db.chat.lines.heard.map((line) => line.text)).toContain("them 1 gio nua nhe shop")
        expect(wakes).toEqual([])
        expect(ended).toEqual([])
        expect(db.wakes).toHaveLength(wakesBefore)
        expect(saidOf(db)).toHaveLength(said)
        // The send door was never reached: no refusal row, no stop, nobody told.
        expect(db.chat.ledger.rows).toHaveLength(ledgerBefore)
        expect(db.records.of("run_stops")).toEqual([])
        expect(db.team).toEqual([])
        // The sale is still parked at its wait, running, with its mark.
        expect(db.records.get(AGENT_RUNS, saleRun)?.data).toMatchObject({ status: "running" })
        expect(db.records.get(AGENT_RUNS, saleRun)?.data.waitMatch).not.toEqual(null)
    })

    it("the release door: the hold is cleared first, then ONE resume event is delivered, the parked wait claims it and the agent answers", async () => {
        const { db, process, saleRun } = await parkedSaleOf()
        await chatServicesOf(db).routes.hold(WS, CONV, "member-1")
        await customersSay(process, [{ text: "them 1 gio nua nhe shop", key: "m-held-2" }])
        const said = saidOf(db).length
        db.model.script(SP.consult, { done: { ...FIRST_ROUND, reply: "Da shop them 1 gio, tong 3 gio nhe chi." } })
        const from = db.wakes.length

        await chatServicesOf(db).routes.release(WS, CONV)
        const wakes = await handedBack(process)

        await expect(chatServicesOf(db).routes.holdOf(WS, CONV)).resolves.toBeNull()
        expect(wakes.map((wake) => wake.agentId).toSorted()).toEqual(["chatbot-agent", "sales-agent"])
        const ended = await runTurns(process, wakes)
        expect(ended.map((one) => [one.ending?.status, one.ending?.reason])).toEqual([["done", "wait_took"], ["skipped", "no_waiter"]])
        const resumed = await drain(process, from)
        expect(resumed.map((one) => one.error)).toEqual([null])
        // The agent answered once, to the person, on the same run; the held line is in the conversation it read.
        expect(saidOf(db).slice(said)).toEqual(["Da shop them 1 gio, tong 3 gio nhe chi."])
        expect([...db.runs.keys()]).toEqual([saleRun])
        // A resume is no line of the person: only the one line said during the hold was kept.
        expect(db.chat.lines.heard.map((line) => line.text)).toEqual(["them 1 gio nua nhe shop"])
    })
})

// The agent that resumes after a hand-back reads the thread SINCE the visit start (v28: `consult-turn` reads the engine thread itself), which holds the line the
// person said during the hold: it reaches the consult's model request. (Red on v27, `recentLines` was empty; green since the 07:08 build.)
describe("R45: the agent resumed by a hand-back reads the line said during the hold", () => {
    it("the held line reaches the consult's model request", async () => {
        const { db, process } = await parkedSaleOf()
        await chatServicesOf(db).routes.hold(WS, CONV, "member-1")
        await customersSay(process, [{ text: "them 1 gio nua nhe shop", key: "m-held-3" }])
        db.model.script(SP.consult, { done: { ...FIRST_ROUND, reply: "Da shop them 1 gio nhe chi." } })
        const from = db.wakes.length

        await chatServicesOf(db).routes.release(WS, CONV)
        await runTurns(process, await handedBack(process))
        await drain(process, from)

        expect(JSON.stringify(db.model.askedOf(SP.consult).at(-1)?.request)).toContain("them 1 gio nua nhe shop")
    })
})

// R41 Q10 (sale v25): a first message judged NOT about a sale (round 1, no event to hand back) must not end with nothing sent and nobody told: the
// run ends `not-sale` after a TEAM notice on /chat (no customer text, no AI). The consult answers `off` with no reply: nothing is sent to the person.
// v28 road (07:08): the notice sits INSIDE round 1 (a node step, `next: endRound`), so the loop's `last` is the notice's own output under either reading of `last`;
// `not-sale-said` = `present(last.posted)` -> outcome `not-sale`. (On v27 this was red: `last` was the `off-round` if-step's `{ branch: "yes" }`; the engine and the
// SDK disagreed on what `last` is, Opus-1h aligns the engine on the last NODE step: this world is the proof of the real loop.)
describe("a first message that is not about a sale: the team is told, the person gets nothing from the sale", () => {
    it("round 1 ends in off-round, its not-sale-notice, then not-sale-said and the outcome not-sale; one team notice names the route and the words; nothing is said", async () => {
        const world = await salesWorldOf(SALE_TRUTHS)
        const { db, process } = world
        db.model.script(SP.consult, { done: { ...FIRST_ROUND, branch: "off", reply: null, items: [] } })

        const ended = await handedToConsult(world, "Shop mo cua may gio vay?")

        expect(ended?.error).toBeNull()
        expect(await threadStepsOf(process, ended?.runId ?? "")).toEqual(
            expect.arrayContaining(["talk[r1].opening", "talk[r1].consult", "talk[r1].off-round", "talk[r1].not-sale-notice", "not-sale-said", "not-sale"]),
        )
        expect(saidOf(db)).toEqual([])
        expect(db.team).toHaveLength(1)
        expect(JSON.stringify(db.team[0])).toContain("Shop mo cua may gio vay?")
    })
})
