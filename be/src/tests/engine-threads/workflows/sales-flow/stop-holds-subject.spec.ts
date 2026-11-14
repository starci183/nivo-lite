import { AGENT_RUNS } from "@tests/fixtures/builders/engine-core-tables.builder"
import { ANSWER, CONTACT, UNDERSTAND, button, customersSay, founderDecides, runTurns } from "../../thread-world"
import { heldWakesOf, holdProvidersOf } from "../reconcile/thread-world-money-holds"
import { SALE_TRUTHS, SP, handedToConsult, salesWorldOf } from "./thread-world-sales"

// RULE Q-1 (R71/R73; it replaces the contact freeze of MX-CORE DEF-1 / R64): a run that is not finished keeps its SUBJECT for every workflow.
// A stop is not finished: the run that stopped holds its person until the founder answers (Retry / Take over / Skip), so the person's next
// line, a wake of ANOTHER workflow (the front desk) on the same route, starts no run: it ends `held` with the reason `waiting:<run>`, waits
// as a held wake, and is pending again when the stopped run is finished.
//
// The dev trace (row G-01f): the front desk handed the person to `sales.consult`; in ROUND 1 (the run had never waited) the consult step could
// not go on and the run stopped; its send had been refused, so the stop held NO customer line. The person's next line was a wake of the FRONT
// DESK workflow on the same route: it ran (hear, understand, to-consult: AI spent) and only its hand-off to consult was held.
//
// Why the single-workflow stop worlds (`stops`, `take-over`, `take-over-hand-back`, `one-line-per-stop`) never saw it: the stopped run and the
// next line are always of the same workflow there, which the old workflow rule already held; this world holds across two workflows.
//
// REAL: the sales agent's seeded workflows and the chatbot front desk (the REAL flows, node host, stops, cards), the REAL hand-off road
// (`deliver` of `workflow.called`), the REAL Zalo entry for the next line, the REAL subject hold (graph half `AgentGraphSubjectHoldsService`,
// thread half `ThreadSubjectHoldsService`: the open stops about a person, the release of held wakes) over the world's runs, stops and wake
// table. Doubles: the model (scripted per purpose), the outside acts, the stores.

/** The AI core's report of the consult that cannot go on: nothing for the customer (the step told them nothing, as on dev). */
const REPORT = {
    decision: "report",
    reason: "Khach hoi dieu shop chua co du lieu.",
    question: "Shop co nhan dat hang rieng khong?",
    suggestions: [{ text: "Co", handledBy: "workflow" }],
    customerLine: null,
}

/** A sale handed over by the front desk that stops in round 1, before it ever waited; the world composes the hold of a subject. */
const stoppedInRoundOne = async () => {
    const world = await salesWorldOf(SALE_TRUTHS, () => undefined, holdProvidersOf)
    const { db } = world
    db.model.script(SP.consult, { confused: { reason: "Khong co du lieu", question: "Shop co nhan dat hang rieng khong?" } })
    db.model.script(SP.core, REPORT)
    const handed = await handedToConsult(world, "Shop co nhan dat gio hoa rieng khong?")
    const saleRun = handed?.runId ?? ""
    return { ...world, saleRun }
}

/** The person's next line after the stop, run as the drain does: [the front desk's wake, the sales agent's listen-only one]. */
const nextLine = async (world: Awaited<ReturnType<typeof stoppedInRoundOne>>) => {
    const wakes = await customersSay(world.process, [{ text: "Alo shop oi, sao im vay?", key: "m-after-stop" }])
    return { wakes, ended: await runTurns(world.process, wakes) }
}

describe("rule Q-1: a stopped run holds its person for every workflow", () => {
    it("the stop stands open and the run is not finished: nothing is held until the person writes", async () => {
        const { db, saleRun } = await stoppedInRoundOne()

        const [stop] = db.records.of("run_stops").map((row) => row.data)
        expect(stop).toMatchObject({ runId: saleRun, state: "open", customerLines: [], contactId: CONTACT })
        expect(heldWakesOf(db)).toEqual([])
    })

    it("the person's next line (a FRONT DESK wake on the same route) starts no run: it ends `held` with `waiting:<consult run>`", async () => {
        const world = await stoppedInRoundOne()
        const { db, saleRun } = world
        const runsBefore = db.records.of(AGENT_RUNS).length
        const asked = db.model.askedOf(SP.consult).length
        const understood = db.model.askedOf(UNDERSTAND).length

        const { ended } = await nextLine(world)

        // Two wakes, as the app writes them: the front desk's (the registration that takes the line) and the sales agent's listen-only one
        // (its graphs only `wait` on the verb; no parked run takes it: the normal no-op). The front desk's is HELD behind the stopped run.
        expect(ended.map((one) => [one.ending?.status, one.ending?.reason]).toSorted()).toEqual([
            ["held", `waiting:${saleRun}`],
            ["skipped", "no_waiter"],
        ])
        // 0 runs: the front desk did not run (no hear / understand / to-consult), so no AI was spent and nothing was handed off.
        expect(db.records.of(AGENT_RUNS)).toHaveLength(runsBefore)
        expect(db.model.askedOf(SP.consult)).toHaveLength(asked)
        expect(db.model.askedOf(UNDERSTAND)).toHaveLength(understood)
        // The line waits as a held wake behind the stopped run (the same one), to be taken once after the founder's answer.
        expect(heldWakesOf(db).map((wake) => wake.reason)).toEqual([`waiting:${saleRun}`])
        expect(db.records.get(AGENT_RUNS, saleRun)?.data).not.toMatchObject({ status: "done" })
    })

    it("after the founder's Skip the held wake is pending again and ONE front-desk run takes it", async () => {
        const world = await stoppedInRoundOne()
        const { db, process, saleRun } = world
        const { wakes } = await nextLine(world)
        const [front] = wakes
        expect(heldWakesOf(db)).toHaveLength(1)
        const runsBefore = db.records.of(AGENT_RUNS).length

        // The skipped run is finished: the line held behind it is pending again, the SAME wake (nothing is written anew).
        await founderDecides(process, saleRun, button(db, "skip"))
        expect(heldWakesOf(db)).toEqual([])
        expect(front).toMatchObject({ state: "pending" })

        db.model.script(UNDERSTAND, { done: { branch: "question", summary: "Khach hoi lai" } })
        db.model.script(ANSWER, { done: { reply: "Da em dang hoi lai tiem a." } })
        const taken = await runTurns(process, wakes)

        // ONE front-desk run took it (the sales agent's listen-only wake is already over).
        expect(taken).toHaveLength(1)
        expect(taken[0]?.error).toBeNull()
        expect(taken[0]?.runId).not.toBe(saleRun)
        expect(db.records.of(AGENT_RUNS)).toHaveLength(runsBefore + 1)
        expect(heldWakesOf(db)).toEqual([])
    })
})
