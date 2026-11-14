import { TOOL } from "@nivo-lite/agent-sdk/names"
import { AgentGraphWakeNoticesService } from "@modules/domain/agent-graphs/agent-graph-wake-notices.service"
import { AGENT_RUNS } from "@tests/fixtures/builders/engine-core-tables.builder"
import { CONTACT, CONV, actsOf, runTurns } from "../../thread-world"
import { calledWorkflow } from "../../thread-world-intake"
import { FRONT } from "../../thread-world-process"
import { threadStepsOf } from "../../thread-world-w8-wakes"
import { SALES } from "../reconcile/thread-world-money"
import { SP, customerSaysToSale, handedToConsult, salesWorldOf, toldOf } from "./thread-world-sales"

// DEF-5 (MX P-07b, R72): the sale is parked in its payment loop; the person writes a line that is not about the order. The pay loop hands it back
// (`pay[rN].give-back`), the front desk takes it and routes it `buy`, and its hand-off calls the sale AGAIN for the same person: the one run
// of the sale for that person is the very run that handed the line back. Before the fix the call wake was held `waiting:<the sale run>`, was
// released and held again at each park of the sale (each release cost one of its 3 tries), and died `dead`/`attempts` when the sale ended:
// no answer, no team notice. Now it is never queued behind that run: it ends at once `call_handed_back` and the team is told.

const TRUTHS = [
    { id: "fact-basket", subject: "Gio hoa nho", attribute: "gia", value: "2000 d", unit: null, num: 2000 },
    { id: "fact-pay", subject: "thanh toan", attribute: "chuyen khoan", value: "ACB 123456, Hoa Shop" },
]
const SUMMARY = "Chi Lan oi, shop tom tat: 2 gio hoa nho (2.000 d/gio), giao 25 Nguyen Hue, chi Lan 0901 234 567, thu Bay 9-11h. Chi dong y nhe?"
const TOLD = "Don DH-20261113-0001 da ghi: 2 gio hoa nho, tong 4.000 d. Chi chuyen khoan ACB 123456 (Hoa Shop), noi dung DH-20261113-0001 nhe."
const NONE = { occasions: null, cancelOrderId: null, cancelReason: null }
const DELIVERY = { address: "25 Nguyen Hue", recipientName: "Lan", recipientPhone: "0901 234 567", deliveryAt: "thu Bay 9-11h" }
const LINES = [{ name: "Gio hoa nho", quantity: 2, unitVnd: 2000 }]
const ASKED = { branch: "asked", reply: SUMMARY, items: LINES, ...DELIVERY, ...NONE }
const READY = { branch: "ready", reply: null, items: LINES, ...DELIVERY, ...NONE }
const ORDER_TALK = "sales.order-talk:agent"
const searches = (query: string) => ({ call: { tool: TOOL.brainSearch, args: { query } } })

/** The sale up to the order: the consult asks, the person agrees, the order is recorded and told; the run parks at the payment wait. */
const ordered = async () => {
    // The engine's wake reports (`AgentGraphWakeNoticesService`, provided by agent-graphs in the app) post to the world's team chat.
    const world = await salesWorldOf(TRUTHS, () => undefined, () => [AgentGraphWakeNoticesService])
    const { db } = world
    db.model.script(SP.consult, searches("gio hoa nho gia"), { done: ASKED })
    const first = await handedToConsult(world, "2 gio hoa nho giao 25 Nguyen Hue, chi Lan 0901 234 567, thu Bay 9-11h")
    expect(first?.error).toBeNull()
    db.model.script(SP.consult, { done: READY })
    db.model.script(SP.orderTell, searches("cach thanh toan chuyen khoan"), { done: { text: TOLD } })
    const agreed = await customerSaysToSale(world, "Dong y", "m-agree-1")
    expect(agreed.resumed.map((one) => one.error)).toEqual([null])
    return { world, runId: first?.runId ?? "" }
}

/** The front desk's hand-off of the line (its `to-consult` tag effect) delivered as the real effect does: pinned, with the calling agent and run. */
const frontDeskCalls = async (world: Awaited<ReturnType<typeof ordered>>["world"], frontRunId: string) => {
    const [handOff] = actsOf(world.db, TOOL.agentTag)
    const call = (handOff?.payload as { context?: { workflowCall?: { workflow: string }; params?: Record<string, unknown> } }).context
    expect(call?.workflowCall?.workflow).toBe("consult")
    const wakes = await calledWorkflow(world.db, {
        agentId: SALES,
        workflow: "consult",
        params: call?.params ?? {},
        key: `call:${frontRunId}:sales.consult`,
        contactId: CONTACT,
        routeId: CONV,
        caller: { agentId: FRONT, runId: frontRunId },
    })
    return { wakes, ran: await runTurns(world.process, wakes) }
}

describe("DEF-5: a line the payment loop hands back, routed `buy` by the front desk, is never lost behind the sale that handed it back", () => {
    it("the front desk's call of the sale ends at once `call_handed_back` (no held wake), the team is told once, the sale waits on", async () => {
        const { world, runId } = await ordered()
        const { db, process } = world
        db.model.script(ORDER_TALK, { done: { topic: "off", reply: null } })
        db.model.script("chatbot.understand:agent", { done: { branch: "buy", summary: "Lan: chau cay canh" } })
        const toldBefore = toldOf(db).length

        const said = await customerSaysToSale(world, "Tiem co ban chau cay canh khong?", "m-off-buy")

        expect(said.resumed.map((one) => one.error)).toEqual([null])
        expect(await threadStepsOf(process, runId)).toEqual(expect.arrayContaining(["pay[r1].order-talk", "pay[r1].give-back"]))
        // The front desk took the handed-back line (its own run) and routed it `buy`: its hand-off calls the sale for the same person.
        const frontRunId = said.reoffered[0]?.runId ?? ""
        expect(said.reoffered.map((one) => one.error)).toEqual([null])
        expect(await threadStepsOf(process, frontRunId)).toEqual(expect.arrayContaining(["hear", "understand", "to-consult"]))

        const { wakes, ran } = await frontDeskCalls(world, frontRunId)

        // Not held `waiting:<the sale run>` (it would be released and held again at every park of the sale, and die with it): ended at once.
        expect(wakes).toHaveLength(1)
        expect(ran.map((one) => [one.ending?.status, one.ending?.reason])).toEqual([["skipped", "call_handed_back"]])
        expect(db.chat.wakes.filter((wake) => wake.reason?.startsWith("waiting:") === true)).toEqual([])
        // No second sale run; the sale still waits for the money.
        expect([...db.runs.keys()]).toEqual([runId, frontRunId])
        expect(db.records.get(AGENT_RUNS, runId)?.data.waitMatch).not.toEqual(null)
        // The team is told once: the engine's report of a line nobody answered.
        expect(toldOf(db).slice(toldBefore)).toEqual(["agentGraphs.wake.lost.sentence"])
        // The person, the workflow it was for, the line and the run it would have waited behind, once per wake.
        const facts = (db.team.at(-1)?.versions[0] as { facts?: ReadonlyArray<{ name: string; value: string }> } | undefined)?.facts ?? []
        expect(Object.fromEntries(facts.map((fact) => [fact.name, fact.value]))).toMatchObject({
            workflow: "consult",
            customer: CONTACT,
            event: "m-off-buy",
            run: runId,
            code: "call_handed_back",
            conversation: CONV,
        })
    })

    it("the control: a call of the sale by a run that did NOT start from a handed-back line waits behind the sale as before (nobody told)", async () => {
        const { world, runId } = await ordered()
        const { db } = world
        const toldBefore = toldOf(db).length

        const wakes = await calledWorkflow(db, {
            agentId: SALES,
            workflow: "consult",
            params: { conversationId: CONV, text: "them 1 gio", channel: "zalo", contactId: CONTACT },
            key: "call:front-desk:other",
            contactId: CONTACT,
            routeId: CONV,
            caller: { agentId: FRONT, runId },
        })
        const ran = await runTurns(world.process, wakes)

        expect(ran.map((one) => [one.ending?.status, one.ending?.reason])).toEqual([["held", `waiting:${runId}`]])
        expect(toldOf(db).slice(toldBefore)).toEqual([])
    })
})
