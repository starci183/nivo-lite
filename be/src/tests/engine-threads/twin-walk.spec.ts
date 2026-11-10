import { TOOL } from "@nivo-lite/blocks-core"
import {
    ANSWER,
    COMPLAINT,
    CONV,
    FRONT_DESK,
    UNDERSTAND,
    customerWrites,
    playOld,
    processOf,
    rowsOf,
    threadDbOf,
    type ThreadDb,
} from "./thread-world"

// Package 0-9, item 1 and 10: the twin walk. The same scripted front-desk conversation through the OLD engine path (flag off: the flow
// writes the first step, the old node step plays the rest) and through a LangGraph thread (flag on: the real flow opens a thread run,
// the real thread runs drive the real LangGraph client over the real saver), for each of the front desk's four routes. The two must
// give the same steps, outputs, effect acts, customer lines and team messages.

type Route = "buy" | "paid" | "complaint" | "question"

/** What the customer says on each route, and what the model answers along it. */
const scripts: Readonly<Record<Route, { readonly text: string; readonly script: (db: ThreadDb) => void }>> = {
    buy: {
        text: "Shop oi cho minh dat 1 bo hoa hong",
        script: (db) => db.model.script(UNDERSTAND, { answer: { branch: "buy", summary: "Lan: buy" } }),
    },
    paid: {
        text: "Minh chuyen khoan roi nhe",
        script: (db) => db.model.script(UNDERSTAND, { answer: { branch: "paid", summary: "Lan: paid" } }),
    },
    complaint: {
        text: "Hoa giao bi heo het roi",
        script: (db) => {
            db.model.script(UNDERSTAND, { answer: { branch: "complaint", summary: "Lan: hoa heo" } })
            db.model.script(
                COMPLAINT,
                {
                    call: {
                        tool: TOOL.customerMessageSend,
                        args: { conversationId: CONV, text: "Shop xin loi, shop kiem tra ngay." },
                    },
                },
                {
                    call: {
                        tool: TOOL.teamMessagePost,
                        args: {
                            kind: "message.text",
                            intent: "notify",
                            audience: "own",
                            title: "Khieu nai",
                            text: "Lan: hoa heo",
                        },
                    },
                },
                { done: { reply: "Shop xin loi, shop kiem tra ngay.", posted: true, summary: "Lan phan nan hoa heo" } },
            )
        },
    },
    question: {
        text: "Shop mo cua may gio?",
        script: (db) => {
            db.model.script(UNDERSTAND, { answer: { branch: "question", summary: "Lan: gio mo cua" } })
            db.model.script(
                ANSWER,
                { call: { tool: TOOL.brainSearch, args: { query: "gio mo cua" } } },
                {
                    call: {
                        tool: TOOL.customerMessageSend,
                        args: { conversationId: CONV, text: "Shop mo cua tu 8h den 21h a." },
                    },
                },
                { done: { reply: "Shop mo cua tu 8h den 21h a." } },
            )
        },
    },
}

/** The steps each route walks, and the effects it acts, in order. */
const PATHS: Readonly<Record<Route, ReadonlyArray<string>>> = {
    buy: ["understand", "to-consult"],
    paid: ["understand", "to-reconcile"],
    complaint: ["understand", "complaint", "to-owner"],
    question: ["understand", "answer"],
}
const ACTS: Readonly<Record<Route, ReadonlyArray<string>>> = {
    buy: [TOOL.agentTag],
    paid: [TOOL.agentTag],
    complaint: [TOOL.customerMessageSend, TOOL.teamMessagePost],
    question: [TOOL.customerMessageSend],
}

/** What a walk left in the world, in a form both engines can be compared on. */
const outcomeOf = (db: ThreadDb) => ({
    acts: db.acts.map((act) => ({ effect: act.effect, payload: act.payload, key: act.key, dedupeKey: act.dedupeKey })),
    lines: db.lines.map((line) => ({
        conversationId: line.conversationId,
        text: line.text,
        channelRef: line.channelRef,
    })),
    team: db.team.map((message) => ({ key: message.key, versions: message.versions })),
    ledger: db.records.of("agent.node-effect").map((row) => row.data),
    modelAsked: db.model.asked.map((one) => one.purpose),
})

const walkOld = async (route: Route) => {
    const db = threadDbOf()
    scripts[route].script(db)
    const process = await processOf(db, { flag: [] })
    const woken = await customerWrites(process, scripts[route].text)
    expect(woken.error).toBeNull()
    const runId = woken.runId ?? ""
    const played = await playOld(process, runId)
    return { db, runId, played, woken }
}

const walkThread = async (route: Route) => {
    const db = threadDbOf()
    scripts[route].script(db)
    const process = await processOf(db, { flag: [FRONT_DESK] })
    const woken = await customerWrites(process, scripts[route].text)
    expect(woken.error).toBeNull()
    const runId = woken.runId ?? ""
    const view = await process.threads.stateOf({
        workspaceId: db.records.get("agent.run", runId)?.workspaceId ?? "",
        runId,
    })
    return { db, runId, woken, view }
}

describe("twin walk: chatbot.front-desk on the old engine and on a LangGraph thread", () => {
    it.each<Route>(["buy", "paid", "complaint", "question"])(
        "route %s: same steps, outputs, effect acts, customer lines and team messages",
        async (route) => {
            const old = await walkOld(route)
            const thread = await walkThread(route)

            expect(thread.woken.ending).toMatchObject({ status: "done" })
            expect(thread.view?.status).toBe("ended")
            expect(old.played.path).toEqual(PATHS[route])
            expect(old.db.acts.map((act) => act.effect)).toEqual(ACTS[route])
            expect(
                thread.db.model.left(UNDERSTAND) + thread.db.model.left(ANSWER) + thread.db.model.left(COMPLAINT),
            ).toBe(0)
            const threadPath = Object.keys(thread.view?.state.steps ?? {})
            expect(threadPath).toEqual(old.played.path)
            const threadOutputs = Object.fromEntries(
                Object.entries(thread.view?.state.steps ?? {}).map(([key, value]) => [
                    key,
                    typeof value === "object" && value !== null ? Reflect.get(value, "output") : null,
                ]),
            )
            expect(threadOutputs).toEqual(old.played.outputs)
            expect(outcomeOf(thread.db)).toEqual(outcomeOf(old.db))
            // Every scripted model answer was used once on each engine: a thread adds no model call.
            expect(thread.db.model.asked.length).toBe(old.db.model.asked.length)
        },
    )

    it.each<Route>(["buy", "paid", "complaint", "question"])(
        "route %s: the thread's projection rows read done, engine langgraph, one row per step in the thread's order",
        async (route) => {
            const thread = await walkThread(route)
            const { run, steps } = rowsOf(thread.db, thread.runId)
            expect(run).toMatchObject({ engine: "langgraph", status: "done" })
            expect(steps.map((step) => [step.stepKey, step.status, step.ordinal])).toEqual(
                Object.keys(thread.view?.state.steps ?? {}).map((key, index) => [key, "done", index + 1]),
            )
        },
    )
})

describe("the flag (item 10)", () => {
    it("off: the old path writes the first step, no checkpoint row exists, the run reads engine legacy", async () => {
        const old = await walkOld("question")

        expect(old.db.appended.get(old.runId)?.map((spec) => spec.stepKey)).toEqual(["understand"])
        expect(old.db.checkpoints.rowsOf(old.runId)).toEqual([])
        expect(rowsOf(old.db, old.runId).run).toMatchObject({ engine: "legacy" })
        expect(rowsOf(old.db, old.runId).steps).toEqual([])
    })

    it("on: no old step is written, the thread holds checkpoints, the run reads engine langgraph", async () => {
        const thread = await walkThread("question")

        expect(thread.db.appended.get(thread.runId) ?? []).toEqual([])
        expect(thread.db.checkpoints.rowsOf(thread.runId).length).toBeGreaterThan(0)
        expect(rowsOf(thread.db, thread.runId).run).toMatchObject({ engine: "langgraph" })
    })
})
