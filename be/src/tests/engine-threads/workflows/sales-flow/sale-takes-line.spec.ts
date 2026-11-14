import { AGENT_RUNS } from "@tests/fixtures/builders/engine-core-tables.builder"
import { WS } from "../../thread-world-records"
import { CONTACT, CONV, UNDERSTAND, customersSay, drain, runTurns } from "../../thread-world"
import { calledWorkflow } from "../../thread-world-intake"
import { threadStepsOf } from "../../thread-world-w8-wakes"
import { SALES } from "../reconcile/thread-world-money"
import { SP, salesWorldOf } from "./thread-world-sales"

// R10 (coordinator + owner, final rule 5 "waits claim first"): a sale run parked at its talk `wait` takes the person's NEXT line before the
// chatbot's front desk does, across agents: the line is delivered once through the real Zalo entry, MATCH asks every agent attached to the
// account (the front desk registers the verb, the sales agent only WAITS on it), and the wait first (`ThreadWaitsService`: the runs parked
// for the event's subject, every attached agent) claims it. The front desk's wake ends as taken (`wait_took`) and starts no run; the sales
// agent's own listening wake ends silently (`no_waiter`: the one event is kept once). Only then did the engine's conversation hold
// (`agent-graph-conversation-holds.service.ts`) become dead code.
// Real: contacts, routes, `deliver` + MATCH, the waits, the run store (subjects, wait marks), the thread engine, the sale graph. Doubles: the
// model (scripted), the tool door's reads and writes of the sales world, the wake table.

const ASKED = {
    branch: "asked",
    reply: "Chi Lan oi, shop tom tat: 2 gio hoa nho. Chi dong y nhe?",
    items: [{ name: "Gio hoa nho", quantity: 2, unitVnd: 2000 }],
    address: "25 Nguyen Hue",
    recipientName: "Lan",
    recipientPhone: "0901 234 567",
    deliveryAt: "thu Bay 9-11h",
    occasions: null,
    cancelOrderId: null,
    cancelReason: null,
}
const TRUTHS = [{ id: "fact-basket", subject: "Gio hoa nho", attribute: "gia", value: "2000 d", unit: null, num: 2000 }]
const NEXT = "them 1 gio nua nhe shop"

/** A sale run of the front desk's hand-off, parked at its talk `wait` after the consult's first round. */
const parkedSale = async () => {
    const world = await salesWorldOf(TRUTHS)
    const { db, process } = world
    db.model.script(SP.consult, { done: ASKED })
    const handed = await calledWorkflow(db, {
        agentId: SALES,
        workflow: "consult",
        params: { conversationId: CONV, text: "2 gio hoa nho giao 25 Nguyen Hue", channel: "zalo", contactId: CONTACT },
        key: "call:front-desk:1",
        contactId: CONTACT,
        routeId: CONV,
    })
    expect(handed).toHaveLength(1)
    const started = (await runTurns(process, handed))[0]
    expect(started?.error).toBeNull()
    const saleRun = started?.runId ?? ""
    // The talk loop's consult answered and the run parked at `hear`, holding the keys of the line it waits for.
    // Round 1 consults on the hand-off's words; round 2 opens and PARKS at `hear` for the person's next line (sale graph v24).
    expect(await threadStepsOf(process, saleRun)).toEqual(["talk[r1].opening", "talk[r1].consult", "talk[r2].opening"])
    expect(db.records.get(AGENT_RUNS, saleRun)?.data.waitMatch).not.toEqual(null)
    return { db, process, saleRun }
}

describe("a sale parked at its wait takes the person's next line before the front desk (R10)", () => {
    it("the front desk's wake ends as taken and starts no run; the sale run takes the line and goes on to its next round", async () => {
        const { db, process, saleRun } = await parkedSale()

        // The person writes: one delivery, one wake per attached agent (the front desk registers the verb, the sales agent only waits on it).
        const from = db.wakes.length
        const wakes = await customersSay(process, [{ text: NEXT, key: "m-next-1" }])
        expect(wakes.map((wake) => wake.agentId).toSorted()).toEqual(["chatbot-agent", "sales-agent"])

        const ended = await runTurns(process, wakes)

        // The front desk took nothing: its wake ended as taken, it understood nothing and no run of it exists. The sales agent's own
        // listening wake is the same event, kept once: it ends silently.
        expect(ended.map((one) => [one.ending?.status, one.ending?.reason])).toEqual([
            ["done", "wait_took"],
            ["skipped", "no_waiter"],
        ])
        expect(db.model.askedOf(UNDERSTAND)).toHaveLength(0)
        expect([...db.runs.keys()]).toEqual([saleRun])

        // The parked sale run resumes (the engine's own wake): the wait has the line and the next round's consult runs.
        db.model.script(SP.consult, { done: ASKED })
        const resumed = await drain(process, from)
        expect(resumed.map((one) => one.error)).toEqual([null])
        expect(await threadStepsOf(process, saleRun)).toEqual(["talk[r1].opening", "talk[r1].consult", "talk[r2].opening", "talk[r2].hear", "talk[r2].consult", "talk[r3].opening"])
        const view = await process.threads.stateOf({ workspaceId: WS, runId: saleRun })
        expect(view?.state.steps["talk[r2].hear"]).toMatchObject({ output: { trigger: "zalo", event: { data: { text: NEXT } } } })
    })

    // The design: the consult of round 2 reads the message the `hear` of that round took (`latest`). It was red while the adapter dropped
    // `{ round }` from a ref; Opus-3e fixed it.
    it("the next round's consult reads the line the wait took (round: previous)", async () => {
        const { db, process } = await parkedSale()
        const from = db.wakes.length
        await runTurns(process, await customersSay(process, [{ text: NEXT, key: "m-next-1" }]))
        db.model.script(SP.consult, { done: ASKED })
        await drain(process, from)

        expect(JSON.stringify(db.model.askedOf(SP.consult).at(1)?.request)).toContain(NEXT)
    })
})
