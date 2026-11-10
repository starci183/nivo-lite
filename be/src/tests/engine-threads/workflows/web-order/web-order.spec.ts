import { TOOL } from "@nivo-lite/blocks-core"
import { LEAD, actsOf, answer, founderDecides, redrive, rowsOf, stopsOf } from "../../thread-world"
import {
    W8P,
    confusedAnswer,
    coreReport,
    diesAtDone,
    threadStatusOf,
    threadStepsOf,
    w8OutcomeOf,
    w8ProcessOf,
    w8Wake,
    websiteWake,
} from "../../thread-world-w8-wakes"
import { calls, linesOf, moneyDbOf, type MoneyDb } from "../reconcile/thread-world-money"
import { moneyProcessOf } from "../reconcile/thread-world-money-process"
import baseline from "./web-order.baseline.json"

// Package W8 (design row 2-3): `sales.web-order` (read → to-owner) on a LangGraph thread, woken by an accepted website form. The form has
// no chat: nothing ever goes to a customer; the team is asked to call. Twin walk against the old engine
// (fixed baseline: the old engine's walk, which this twin held equal to the thread at tree aa40f9655; old half removed in phase 3, package X1), one stop, one kill after the team was told.

const books = () => ({
    "catalogue-item": [
        { id: "c1", name: "Gio hoa nho", active: true, priceVnd: 2000 },
        { id: "c2", name: "Bo hoa cu", active: false, priceVnd: 9000 },
    ],
})
const FORM = { inboundEventId: "inbound-1", request: "2 gio hoa nho giao 25 Nguyen Hue thu Bay", phone: "0901234567" }
const FACTS = {
    leadId: LEAD,
    consultStage: "close",
    facts: { address: "25 Nguyen Hue", deliveryAt: "thu Bay" },
}
const NOTICE = {
    kind: "message.text",
    intent: "ask",
    title: "Don web moi: goi xac nhan",
    text: "Khach Lan dat 2 Gio hoa nho giao 25 Nguyen Hue thu Bay qua website. Goi 0901234567 de xac nhan.",
}
const SUMMARY = "Khach web Lan dat 2 Gio hoa nho, goi 0901234567 de xac nhan"
const PATH = ["read", "to-owner"]

const reads = (db: MoneyDb) =>
    db.model.script(
        W8P.webOrder,
        calls(TOOL.leadUpdate, FACTS),
        calls(TOOL.teamMessagePost, NOTICE),
        { done: { leadId: LEAD, summary: SUMMARY } },
    )

const started = async (script: (db: MoneyDb) => void) => {
    const process = await w8ProcessOf(books(), script)
    const woken = await w8Wake(process, websiteWake(FORM))
    expect(woken.error).toBeNull()
    return { process, db: process.db, runId: woken.runId ?? "" }
}

describe("web-order on a thread against the old engine's baseline", () => {
    it("read → to-owner: the old engine's steps, acts, card, ledger and model calls; no customer line", async () => {
        const old = baseline
        const thread = await started(reads)

        expect(await threadStatusOf(thread.process, thread.runId)).toBe("ended")
        expect(await threadStepsOf(thread.process, thread.runId)).toEqual(PATH)
        expect(w8OutcomeOf(thread.db)).toEqual(old.outcome)
        expect(thread.db.acts.map((act) => act.effect)).toEqual([TOOL.leadUpdate, TOOL.teamMessagePost])
        expect(thread.db.team.map((message) => message.versions)).toEqual([[NOTICE]])
        expect(linesOf(thread.db)).toEqual([])
        // The agent saw the active catalogue only, by name, no price.
        const asked = JSON.stringify(thread.db.model.askedOf(W8P.webOrder)[0]?.request)
        expect(asked).toContain("Gio hoa nho")
        expect(asked).not.toContain("Bo hoa cu")
        expect(asked).toContain("0901234567")
        // A thread adds no model call: 3 on the old engine.
        expect(thread.db.model.asked.length).toBe(old.asked)
        expect(rowsOf(thread.db, thread.runId).run).toMatchObject({ engine: "langgraph", status: "done" })
    })
})

describe("web-order on a thread: the stop", () => {
    it("a request the agent cannot read: a stop, one card, no customer line; re-drives move nothing; the founder's words resume it", async () => {
        const Q = "Khach viet 'nhu lan truoc' nhung chua tung mua, dat mon nao?"
        const { process, db, runId } = await started((one) => {
            one.model.script(W8P.webOrder, calls(TOOL.leadUpdate, FACTS), confusedAnswer("Khong ro mon", Q))
            one.model.script(W8P.core, coreReport(Q))
        })

        expect(await threadStatusOf(process, runId)).toBe("stopped")
        const [stop] = await stopsOf(process, runId)
        expect(stop).toMatchObject({ stepKey: "read", kind: "ai_report", state: "open" })
        expect(stop?.customerLines).toEqual([])
        expect(linesOf(db)).toEqual([])
        expect(db.team.map((message) => message.key)).toEqual([`run-stuck:${runId}:read`])
        const asked = db.model.asked.length
        await redrive(process, runId, "sweep-1")
        await redrive(process, runId, "sweep-2")
        expect(db.model.asked.length).toBe(asked)

        db.model.script(W8P.webOrder, calls(TOOL.teamMessagePost, NOTICE), { done: { leadId: LEAD, summary: SUMMARY } })
        const ran = await founderDecides(process, runId, answer(db, "Lay gio hoa nho, 2 cai"))

        expect(ran.map((one) => one.error)).toEqual([null])
        expect(JSON.stringify(db.model.askedOf(W8P.webOrder).at(-1)?.request)).toContain("Lay gio hoa nho, 2 cai")
        expect(await threadStatusOf(process, runId)).toBe("ended")
        expect(await threadStepsOf(process, runId)).toEqual(PATH)
        expect(db.records.of("agent.run-stop", { runId })).toHaveLength(1)
        expect((await stopsOf(process, runId))[0]).toMatchObject({ state: "resolved", decision: { kind: "answer" } })
        // The facts kept before the stop stay as they were (nothing undone); the team gets its one call-back card besides the stop card.
        expect(actsOf(db, TOOL.leadUpdate).map((act) => act.payload)).toEqual([FACTS])
        expect(db.team.map((message) => message.key)).toEqual([`run-stuck:${runId}:read`, expect.any(String)])
        expect(db.team[1]?.versions).toEqual([NOTICE])
        expect(linesOf(db)).toEqual([])
    })
})

describe("web-order on a thread: killed and replayed", () => {
    it("killed after the team was told (read acted, its checkpoint not written): one card, one lead update", async () => {
        const db = moneyDbOf(books())
        reads(db)
        diesAtDone(db, 1)
        const first = await moneyProcessOf(db)
        const woken = await w8Wake(first, websiteWake(FORM))
        expect(String(woken.error)).toContain("WORLD_PROCESS_DIED")
        const runId = woken.runId ?? ""
        expect(db.team).toHaveLength(1)

        reads(db)
        const second = await moneyProcessOf(db)
        const ran = await redrive(second, runId, "sweep-1")

        expect(ran.map((one) => one.error)).toEqual([null])
        expect(await threadStatusOf(second, runId)).toBe("ended")
        expect(await threadStepsOf(second, runId)).toEqual(PATH)
        expect(actsOf(db, TOOL.leadUpdate)).toHaveLength(1)
        expect(actsOf(db, TOOL.teamMessagePost)).toHaveLength(1)
        expect(db.team.map((message) => message.versions)).toEqual([[NOTICE]])
        expect(rowsOf(db, runId).run).toMatchObject({ status: "done" })
    })
})
