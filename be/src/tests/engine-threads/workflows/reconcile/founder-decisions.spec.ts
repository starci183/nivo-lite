import { memoryEffectStore } from "@tests/fixtures/builders/engine-core-tables.builder"
import type { Provider } from "@nestjs/common"
import { AgentGraphTurnPolicyService } from "@modules/domain/agent-graphs"
import { AgentGraphRunQueueService } from "@modules/domain/agent-graphs/agent-graph-run-queue.service"
import { RunStopRecordsService } from "@modules/domain/agent-threads"
import { chatServicesOf } from "../../thread-world-intake"
import { ANSWER, UNDERSTAND, answer, button, customerWrites, drain, founderDecides, refOf, stopsOf } from "../../thread-world"
import { linesOf, moneyDbOf, type MoneyDb } from "./thread-world-money"
import { freezesOf, holdProvidersOf } from "./thread-world-money-holds"
import { moneyProcessOf } from "./thread-world-money-process"

// D-MX-1 (matrix walk S1, dev 2026-11-11, runs 640f1005 + c0491dcf): the customer asked "Shop co xuat hoa don VAT cho cong ty khong?";
// the front desk's answer step held one line and stopped (6712ee93); the customer wrote again (held); the founder answered "Co xuat VAT,
// khach gui ma so thue va email, phi 8%"; the resumed step answered right (7c588bb8), then the held line was replayed into a FRESH
// front-desk run whose answer step knew nothing of the founder's words and told the customer the 8% was "chua co xac nhan tu tiem"
// (54005441), opening a second stop for the same question. The founder's answers on a customer's stops are part of the customer's one
// memory across runs: the run that reads the held line reads them. Ledger (TOOLS-LEAD F2): the spec expected the held line REPLAYED into a
// fresh run (`replay[0].runId` another run); the engine's rule (`layers` (1), `joinedByDecision`) is that the next event of the subject
// resumes THAT thread: a line held before an answer joins the run and its re-run reads it (`ctx.run.joined`), so no wake is written for
// it and no fresh run exists. The fix of D-MX-1 holds on the joined road: the re-run step reads the founder's answer and the line.
// Here with the REAL hold, the REAL stops and the REAL turn policy.

const QUESTION_LINE = "Shop oi shop co xuat hoa don VAT cho cong ty khong a?"
const HOLDING = "Da em hoi lai tiem roi bao minh ngay a."
const AGAIN = "Hoa don ghi ten Cong ty TNHH Hoa Lan giup minh nhe"
const FOUNDER = "Co xuat VAT, khach gui ma so thue va email, phi 8%"
const VAT_ANSWER = "Da tiem co xuat VAT a, minh gui ma so thue va email giup em, phi 8%."
const ASKED = "Tiem co xuat hoa don VAT khong?"

/** The REAL turn policy over the world's records: the effect ledger, the stops, the holds (the events that joined the run) and the delivery ledger. */
const turnPolicyOf = (db: MoneyDb): Provider => {
    return {
        provide: AgentGraphTurnPolicyService,
        useFactory: (stops: RunStopRecordsService, queue?: AgentGraphRunQueueService) =>
            new AgentGraphTurnPolicyService(db.clock, undefined, undefined, stops, memoryEffectStore(db.records), chatServicesOf(db).deliveries, queue),
        inject: [RunStopRecordsService, { token: AgentGraphRunQueueService, optional: true }],
    }
}

describe("a customer's held line joins the run the founder answers (D-MX-1)", () => {
    it("LIVE S1: the held line joins the stopped run, whose re-run reads the founder's answer, and its stop is not asked again", async () => {
        const db = moneyDbOf()
        const process = await moneyProcessOf(db, [...holdProvidersOf(db), AgentGraphRunQueueService, turnPolicyOf(db)])
        // The template front desk (version 7): the understand and answer steps are agents (`agent.run`), the answer step sends the reply
        // it is answered; a confused answer sends nothing (decision D2): the holding line is the engine report's line to the customer.
        db.model.script(UNDERSTAND, { done: { branch: "question", summary: "Lan hoi xuat VAT" } })
        db.model.script(ANSWER, { confused: { reason: "Tiem chua co thong tin VAT", question: ASKED } })
        db.model.script("engine:step-trouble", {
            decision: "report",
            reason: "Tiem chua co thong tin VAT",
            question: ASKED,
            suggestions: [
                { text: "Co xuat VAT, phi 8%", handledBy: "workflow" },
                { text: "Khong xuat VAT", handledBy: "workflow" },
            ],
            customerLine: HOLDING,
        })
        const asked = await customerWrites(process, QUESTION_LINE)
        const runId = asked.runId ?? ""
        expect((await stopsOf(process, runId)).map((stop) => [stop.stepKey, stop.state])).toEqual([["answer", "open"]])
        expect(linesOf(db)).toEqual([HOLDING])

        // The customer writes again while the stop is open: held, as before.
        const again = await customerWrites(process, AGAIN)
        expect(again.ending).toMatchObject({ status: "held" })

        // The founder answers; the resumed step answers the question right. The held line JOINED this run (`layers` (1): the next event of
        // the subject resumes THAT thread, never a new run): the re-run step reads it with the founder's answer.
        db.model.script(ANSWER, { done: { reply: VAT_ANSWER } })
        const resumed = await founderDecides(process, runId, answer(db, FOUNDER))
        expect(resumed.map((one) => [one.error, one.runId])).toEqual([[null, runId]])
        expect(freezesOf(db)).toEqual([expect.objectContaining({ status: "released", releaseReason: "stop_closed" })])

        // The held line wrote no wake of its own (only the founder's resume is a wake): no fresh run reads it.
        expect(db.wakes.map((wake) => wake.context.eventName)).toEqual(["engine.thread.resume"])
        const rerun = db.model.askedOf(ANSWER).at(-1)?.request
        expect(rerun?.input).toMatchObject({
            input: { conversation: expect.arrayContaining([`customer: ${AGAIN}`]) },
            founderAnswers: [{ text: FOUNDER }],
        })
        expect(rerun?.volatile).toEqual(expect.stringContaining("`founderAnswers`"))
        expect(linesOf(db)).toEqual([HOLDING, VAT_ANSWER])
        // No second stop for the same question, and no second run.
        expect(db.records.of("run_stops").map((row) => row.data.runId)).toEqual([runId])
        expect([...db.runs.keys()]).toEqual([runId])
    })
    // R18, the SKIP half: a founder who SKIPS the stop ends the run without an answer, so a line held behind it belongs to nobody's thread:
    // it goes to the NEXT run (a fresh one reads it), where on an answer it joined THIS run (the case above).
    it("on SKIP the held line is not taken by the skipped run: it starts the NEXT run of the subject, which reads it", async () => {
        const db = moneyDbOf()
        const process = await moneyProcessOf(db, [...holdProvidersOf(db), AgentGraphRunQueueService, turnPolicyOf(db)])
        db.model.script(UNDERSTAND, { done: { branch: "question", summary: "Lan hoi xuat VAT" } })
        db.model.script(ANSWER, { confused: { reason: "Tiem chua co thong tin VAT", question: ASKED } })
        db.model.script("engine:step-trouble", { decision: "report", reason: "Tiem chua co thong tin VAT", question: ASKED, suggestions: [], customerLine: HOLDING })
        const asked = await customerWrites(process, QUESTION_LINE)
        const runId = asked.runId ?? ""
        expect(((await stopsOf(process, runId)).map((stop) => stop.state))).toEqual(["open"])
        const again = await customerWrites(process, AGAIN)
        expect(again.ending).toMatchObject({ status: "held" })

        const from = db.wakes.length
        db.model.script(UNDERSTAND, { done: { branch: "question", summary: "Lan gui ten cong ty" } })
        db.model.script(ANSWER, { done: { reply: VAT_ANSWER } })
        await founderDecides(process, runId, button(db, "skip"))

        expect((await process.threads.stateOf(refOf(runId)))?.status).toBe("ended")
        expect(freezesOf(db)).toEqual([expect.objectContaining({ status: "released" })])
        // The held line is written again as a wake of its own, and a FRESH run (not the skipped one) reads it.
        const replay = await drain(process, from)
        // (the first drive is the skip's own resume of the skipped run; the held line's wake is the last)
        expect(replay.at(-1)?.runId).not.toBe(runId)
        expect([...db.runs.keys()]).toHaveLength(2)
        expect(JSON.stringify(db.model.askedOf(UNDERSTAND).at(-1)?.request)).toContain(AGAIN)
    })
})
