import { TOOL } from "@nivo-lite/blocks-core"
import {
    ANSWER,
    COMPLAINT,
    CONV,
    UNDERSTAND,
    customerWrites,
    processOf,
    rowsOf,
    threadDbOf,
    type ThreadDb,
} from "./thread-world"
import baseline from "./twin-walk.baseline.json"

// Package 0-9, item 1 and 10: the twin walk, threads only since phase 3 (package X1). The scripted front-desk conversation through a
// LangGraph thread (the real flow opens a thread run, the real thread runs drive the real LangGraph client over the real saver), for
// each of the front desk's four routes. The old engine's half is gone; what it walked is kept as a fixed baseline
// (`twin-walk.baseline.json`: the old engine's steps, outputs, effect acts, customer lines, team messages, ledger rows and model calls
// at tree aa40f9655, recorded from its step handler before it was removed). The thread must still give exactly that.

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

/** The steps each route walks, and the effects it acts, in order (the old engine's, the same as the baseline's). */
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

/** What a walk left in the world, in the form the baseline holds. */
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

const walkThread = async (route: Route) => {
    const db = threadDbOf()
    scripts[route].script(db)
    const process = await processOf(db)
    const woken = await customerWrites(process, scripts[route].text)
    expect(woken.error).toBeNull()
    const runId = woken.runId ?? ""
    const view = await process.threads.stateOf({
        workspaceId: db.records.get("agent.run", runId)?.workspaceId ?? "",
        runId,
    })
    return { db, runId, woken, view }
}

describe("twin walk: chatbot.front-desk on a LangGraph thread against the old engine's baseline", () => {
    it.each<Route>(["buy", "paid", "complaint", "question"])(
        "route %s: the old engine's steps, outputs, effect acts, customer lines and team messages",
        async (route) => {
            const old = baseline[route]
            const thread = await walkThread(route)

            expect(thread.woken.ending).toMatchObject({ status: "done" })
            expect(thread.view?.status).toBe("ended")
            expect(old.path).toEqual(PATHS[route])
            expect(thread.db.acts.map((act) => act.effect)).toEqual(ACTS[route])
            expect(
                thread.db.model.left(UNDERSTAND) + thread.db.model.left(ANSWER) + thread.db.model.left(COMPLAINT),
            ).toBe(0)
            const threadPath = Object.keys(thread.view?.state.steps ?? {})
            expect(threadPath).toEqual(old.path)
            const threadOutputs = Object.fromEntries(
                Object.entries(thread.view?.state.steps ?? {}).map(([key, value]) => [
                    key,
                    typeof value === "object" && value !== null ? Reflect.get(value, "output") : null,
                ]),
            )
            expect(threadOutputs).toEqual(old.outputs)
            expect(outcomeOf(thread.db)).toEqual(old.outcome)
            // Every scripted model answer was used once, as on the old engine (baseline: buy 1, paid 1, complaint 4, question 4): a
            // thread adds no model call.
            expect(thread.db.model.asked.length).toBe(old.asked)
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

describe("the thread run (item 10)", () => {
    it("the thread holds checkpoints, the run reads engine langgraph", async () => {
        const thread = await walkThread("question")

        expect(thread.db.checkpoints.rowsOf(thread.runId).length).toBeGreaterThan(0)
        expect(rowsOf(thread.db, thread.runId).run).toMatchObject({ engine: "langgraph" })
    })
})
