import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { AGENT_RUN_STEPS } from "@tests/fixtures/builders/engine-core-tables.builder"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { DESK_CARE } from "@tests/fixtures/builders/thread-desk-plugin.builder"
import {
    ANSWER_NODE,
    ANSWER,
    CONV,
    CORE,
    LEAD,
    UNDERSTAND,
    WS,
    actsOf,
    answer,
    button,
    customerWrites,
    founderDecides,
    ledgerOf,
    processOf,
    redrive,
    refOf,
    startThread,
    stopsOf,
    threadDbOf,
    type ThreadDb,
} from "./thread-world"

// The world's desk installed beside the core: an agent step that acts itself, on the template road (`thread-desk-plugin.builder.ts`).
jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const desk: typeof import("@tests/fixtures/builders/thread-desk-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/thread-desk-plugin.builder",
    )
    return { installed: parts.installationWith([desk.DESK_PLUGIN], "world-desk") }
})

// Package 0-9, items 2 and 3: the REAL effect ledger (GraphNodeEffectsService over the records) and the REAL step receipts of the
// ToolRunner (a step that runs again answers its earlier write at the same position from its receipt, nivo-frame rights 11d) under the
// REAL replay of LangGraph tasks (replayPortsOf through GraphNodeHostService), never a stand-in. "Once" is counted at the outside world: every act that reached the fake channel.

const QUESTION = "Shop mo cua may gio?"
const CHECKING = "Shop dang kiem tra gio mo cua, ban doi chut a."
const OUTCOME = "Shop mo cua tu 8h den 21h a."

const send = (text: string) => ({ call: { tool: TOOL.customerMessageSend, args: { conversationId: CONV, text } } })

/** The log event of a restarted node that leaves its record (`LanggraphLogEvent.ReplayLeft`). */
const REPLAY_LEFT = "langgraph.replay.left"

/** The node whose agent's turns the host's own loop takes in the prebuilt-loop cases (`AGENT_LOOP=prebuilt:<the answer node>`). */
const PREBUILT = [ANSWER_NODE]

/** Lets the work a cut drive left running go on: turns of the event loop until `done` holds, at most `ticks` of them. */
const settledOf = async (done: () => boolean, ticks = 200): Promise<void> => {
    await new Promise((resolve) => setImmediate(resolve))
    if (ticks > 0 && !done()) await settledOf(done, ticks - 1)
}

/** The messages an agent turn of the world's model was sent, as kind and text; empty for a call of the JSON loop. */
const messagesOf = (input: unknown): ReadonlyArray<readonly [string, string]> => {
    const messages: unknown = typeof input === "object" && input !== null ? Reflect.get(input, "messages") : undefined
    return Array.isArray(messages) ? messages.filter((one): one is [string, string] => Array.isArray(one)) : []
}
const confused = { confused: { reason: "Khong thay tai lieu gio mo cua", question: "Shop mo cua may gio?" } }
const report = (customerLine: string | null = null) => ({
    decision: "report",
    reason: "Buoc tra loi khong tim thay gio mo cua.",
    question: "Shop mo cua may gio?",
    suggestions: [
        { text: "8h den 21h", handledBy: "workflow" },
        { text: "Toi tu tra loi", handledBy: "person" },
    ],
    customerLine,
})

/** The front desk understands a question; its answer step tells the customer it is checking, then cannot go on: the AI core reports. */
const stopsAtAnswer = (
    db: ThreadDb,
    options: { readonly sendsFirst?: boolean; readonly holdingLine?: string | null } = {},
) => {
    db.model.script(UNDERSTAND, { done: { branch: "question", summary: "Lan: gio mo cua" } })
    db.model.script(ANSWER, ...(options.sendsFirst === false ? [] : [send(CHECKING)]), confused)
    db.model.script(CORE, report(options.holdingLine ?? null))
}

const started = async (db: ThreadDb) => {
    const process = await processOf(db)
    const woken = await customerWrites(process, QUESTION)
    expect(woken.error).toBeNull()
    const runId = woken.runId ?? ""
    expect((await process.threads.stateOf({ workspaceId: WS, runId }))?.status).toBe("stopped")
    return { process, runId }
}

const sendsOf = (db: ThreadDb): ReadonlyArray<string> =>
    actsOf(db, TOOL.customerMessageSend).map((act) => String(act.payload.text))

describe("the real ledger under replay (item 2)", () => {
    it("stop, the founder answers, the step runs again: the identical line is acted ONCE, the outcome line once", async () => {
        const db = threadDbOf()
        stopsAtAnswer(db)
        const { process, runId } = await started(db)
        expect(sendsOf(db)).toEqual([CHECKING])

        db.model.script(ANSWER, send(CHECKING), send(OUTCOME), { done: { reply: OUTCOME } })
        const ran = await founderDecides(process, runId, answer(db, "Shop mo 8h den 21h"))

        expect(ran.map((one) => one.error)).toEqual([null])
        expect((await process.threads.stateOf({ workspaceId: WS, runId }))?.status).toBe("ended")
        // The repeated line was answered by the ledger (same call key: same step, same digest); the outcome line went out once.
        expect(sendsOf(db)).toEqual([CHECKING, OUTCOME])
        expect(db.lines.map((line) => line.text)).toEqual([CHECKING, OUTCOME])
        // The sends' rows (a template step also keeps its fixed instant and day in the ledger, `engine.step-instant` / `-day`).
        const keys = ledgerOf(db)
            .filter((row) => row.effectId === TOOL.customerMessageSend)
            .map((row) => String(row.effectKey))
        expect(keys.filter((key) => key.startsWith(`call:${runId}:answer:`))).toHaveLength(2)
        // The founder's words reached the step's model request.
        expect(JSON.stringify(db.model.askedOf(ANSWER).at(-1)?.request)).toContain("Shop mo 8h den 21h")
    })

    it("retry after a new build (live: the 4 runs retried after the restart): a NEW process answers the reworded line from the receipt; one line", async () => {
        const db = threadDbOf()
        stopsAtAnswer(db)
        const { runId } = await started(db)

        // The restart: the stopped thread is driven by a process built fresh over the same stores (a new build of the api).
        const rebuilt = await processOf(db)
        db.model.script(ANSWER, send("Shop van dang kiem tra nhe!"), { done: { reply: CHECKING } })
        const ran = await founderDecides(rebuilt, runId, button(db, "retry"))

        expect(ran.map((one) => one.error)).toEqual([null])
        expect((await rebuilt.threads.stateOf({ workspaceId: WS, runId }))?.status).toBe("ended")
        expect(sendsOf(db)).toEqual([CHECKING])
        expect(db.lines).toHaveLength(1)
    })

    it("retry with no words (run eb7c6306): the reworded line is answered from the first line's receipt, the step completes; one line", async () => {
        const db = threadDbOf()
        stopsAtAnswer(db)
        const { process, runId } = await started(db)

        db.model.script(ANSWER, send("Shop van dang kiem tra nhe!"), { done: { reply: CHECKING } })
        const ran = await founderDecides(process, runId, button(db, "retry"))

        expect(ran.map((one) => one.error)).toEqual([null])
        expect((await process.threads.stateOf({ workspaceId: WS, runId }))?.status).toBe("ended")
        expect(sendsOf(db)).toEqual([CHECKING])
        expect(db.lines).toHaveLength(1)
        // No refusal: the send answered as the first one did, so the step went on (no stop, no `already_told_for_this_stop`).
        const last = JSON.stringify(db.model.askedOf(ANSWER).at(-1)?.request)
        expect(last).not.toContain("already_told_for_this_stop")
        const [stop] = await stopsOf(process, runId)
        expect(stop?.state).toBe("resolved")
    })

    it("retry with no words: the identical line replays from the ledger under its own key; one line", async () => {
        const db = threadDbOf()
        stopsAtAnswer(db)
        const { process, runId } = await started(db)

        db.model.script(ANSWER, send(CHECKING), { done: { reply: CHECKING } })
        await founderDecides(process, runId, button(db, "retry"))

        expect((await process.threads.stateOf({ workspaceId: WS, runId }))?.status).toBe("ended")
        expect(sendsOf(db)).toEqual([CHECKING])
        expect(db.lines).toHaveLength(1)
    })

    it("the engine's holding line is no receipt of the step: after a retry the step's own line goes out once", async () => {
        const db = threadDbOf()
        stopsAtAnswer(db, { sendsFirst: false, holdingLine: CHECKING })
        const { process, runId } = await started(db)
        expect(sendsOf(db)).toEqual([CHECKING])
        expect(actsOf(db, TOOL.customerMessageSend)[0]?.key).toBe(`honest-line:${runId}:answer`)
        const [stop] = await stopsOf(process, runId)
        expect(stop?.customerLines.map((line) => line.text)).toEqual([CHECKING])

        db.model.script(ANSWER, send("Da, shop dang xem lai gio mo cua."), { done: { reply: CHECKING } })
        await founderDecides(process, runId, button(db, "retry"))

        // The holding line was the engine's while the step stood stopped; the retried step's own line is its first send: it goes once.
        expect(sendsOf(db)).toEqual([CHECKING, "Da, shop dang xem lai gio mo cua."])
        expect(db.lines).toHaveLength(2)
    })

    it("a different line after an answer goes out once, also when the thread is driven again afterwards", async () => {
        const db = threadDbOf()
        stopsAtAnswer(db)
        const { process, runId } = await started(db)
        db.model.script(ANSWER, send(OUTCOME), { done: { reply: OUTCOME } })
        await founderDecides(process, runId, answer(db, "8h-21h"))

        const again = await processOf(db)
        await expect(redrive(again, runId, "sweep-1")).rejects.toMatchObject({ params: { why: "thread_ended" } })
        expect(sendsOf(db)).toEqual([CHECKING, OUTCOME])
    })
})

describe("kill and replay (item 3)", () => {
    /** The question route, its answer step sending one line and completing. */
    const answers = (db: ThreadDb, times = 1) => {
        db.model.script(UNDERSTAND, { done: { branch: "question", summary: "Lan: gio mo cua" } })
        for (let one = 0; one < times; one += 1)
            db.model.script(
                ANSWER,
                { call: { tool: TOOL.brainSearch, args: { query: "gio mo cua" } } },
                send(OUTCOME),
                { done: { reply: OUTCOME } },
            )
    }

    /** The process dies after the answer step's send acted and its ledger row was written, before the node returned (its checkpoint). */
    const crashesAfterTheSend = (db: ThreadDb) => {
        let done = 0
        db.records.crashOnce((mutation) => {
            if (mutation.entity !== AGENT_RUN_STEPS || mutation.op !== "update" || mutation.values.status !== "done")
                return false
            done += 1
            return done === 2
        })
    }

    it("a crash between the act and the checkpoint: a new process drives the thread on and nothing is sent twice", async () => {
        const db = threadDbOf()
        answers(db, 2)
        crashesAfterTheSend(db)
        const first = await processOf(db)
        const woken = await customerWrites(first, QUESTION)
        expect(String(woken.error)).toContain("WORLD_PROCESS_DIED")
        const runId = woken.runId ?? ""
        expect(sendsOf(db)).toEqual([OUTCOME])
        expect((await first.threads.stateOf({ workspaceId: WS, runId }))?.status).toBe("open")

        const second = await processOf(db)
        const ran = await redrive(second, runId, "sweep-1")

        expect(ran.map((one) => one.error)).toEqual([null])
        expect((await second.threads.stateOf({ workspaceId: WS, runId }))?.status).toBe("ended")
        expect(sendsOf(db)).toEqual([OUTCOME])
        expect(db.lines).toHaveLength(1)
        expect(db.model.askedOf(UNDERSTAND)).toHaveLength(1)
    })

    // COST D-0-9-1, settled (ruling F2, accepted by the coordinator 2026-11-13): the old cost was the whole agent step asked again after
    // a crash mid-step (3 → 6 model turns), because `chatbot.answer` read the line it had sent itself inside its turns. Since the flip
    // (template nodes) the re-run of the step finds its turns in the replay record (no `langgraph.replay.left`) and asks the model
    // nothing new: 3 turns in all. The send stays at one, by the ledger.
    it("cost D-0-9-1: after a crash mid-step an agent step asks the model no turn again (3), and the line is sent ONCE", async () => {
        const db = threadDbOf()
        answers(db, 2)
        crashesAfterTheSend(db)
        const first = await processOf(db)
        const runId = (await customerWrites(first, QUESTION)).runId ?? ""
        expect(db.model.askedOf(ANSWER)).toHaveLength(3)

        const second = await processOf(db)
        const ran = await redrive(second, runId, "sweep-1")

        expect(ran.map((one) => one.error)).toEqual([null])
        expect((await second.threads.stateOf({ workspaceId: WS, runId }))?.status).toBe("ended")
        expect(second.logger.warn).not.toHaveBeenCalledWith(REPLAY_LEFT, expect.anything())
        expect(db.model.askedOf(ANSWER)).toHaveLength(3)
        expect(sendsOf(db)).toEqual([OUTCOME])
        expect(db.lines).toHaveLength(1)
    })

    it("the task records lost too: the step runs live again, the ledger alone keeps the send at one", async () => {
        const db = threadDbOf()
        answers(db, 2)
        crashesAfterTheSend(db)
        const first = await processOf(db)
        const runId = (await customerWrites(first, QUESTION)).runId ?? ""

        db.forgetTaskWrites = true
        const second = await processOf(db)
        const ran = await redrive(second, runId, "sweep-1")

        expect(ran.map((one) => one.error)).toEqual([null])
        expect(db.model.askedOf(ANSWER)).toHaveLength(6)
        expect(sendsOf(db)).toEqual([OUTCOME])
        expect(db.lines).toHaveLength(1)
    })
})

/** The drive of the first process loses its lease (the signal aborts) after the answer step's send acted, while its next turn waits. */
const abortedAfterTheSend = async (db: ThreadDb) => {
    db.model.script(UNDERSTAND, { done: { branch: "question", summary: "Lan: gio mo cua" } })
    db.model.script(ANSWER, send(OUTCOME))
    const first = await processOf(db)
    const controller = new AbortController()
    const held = db.model.hold(ANSWER, 1)
    const pending = customerWrites(first, QUESTION, { signal: controller.signal })
    await held.entered
    expect(sendsOf(db)).toEqual([OUTCOME])
    controller.abort()
    db.model.script(ANSWER, { done: { reply: OUTCOME } })
    held.release()
    const woken = await pending
    expect(String(woken.error)).toContain("Abort")
    return { first, runId: woken.runId ?? "" }
}

describe("kill and replay (item 3): a lost lease, an outcome-unknown code", () => {
    it("a drive aborted (lease lost) after the act: the thread stays open and a re-drive from a new process sends nothing twice", async () => {
        const db = threadDbOf()
        const { runId } = await abortedAfterTheSend(db)
        expect((await (await processOf(db)).threads.stateOf({ workspaceId: WS, runId }))?.status).toBe(
            "open",
        )

        db.model.script(ANSWER, send(OUTCOME), { done: { reply: OUTCOME } })
        const second = await processOf(db)
        const ran = await redrive(second, runId, "sweep-1")

        expect(ran.map((one) => one.error)).toEqual([null])
        expect((await second.threads.stateOf({ workspaceId: WS, runId }))?.status).toBe("ended")
        expect(sendsOf(db)).toEqual([OUTCOME])
    })

    // D-0-9-2 (fixed): when the lease is lost the library refuses the node's next recorded call with "Aborted"; the node function (still
    // running in the old process) now ends silently: no AI core, no stop, no card. The next driver completes the step.
    it("a drive aborted (lease lost) opens no stop and posts no card for the founder", async () => {
        const db = threadDbOf()
        const { first, runId } = await abortedAfterTheSend(db)

        expect(await stopsOf(first, runId)).toEqual([])
        expect(db.team).toEqual([])
        expect(db.model.askedOf(CORE)).toHaveLength(0)
    })

    it("an outcome-unknown code stops for the founder; the machine never runs the step again", async () => {
        const db = threadDbOf()
        db.model.script(UNDERSTAND, { done: { branch: "buy", summary: "Lan: buy" } })
        db.model.script(CORE, report(null))
        db.throwOn.set(TOOL.agentTag, Object.assign(new Error("tag sent, no answer"), { code: "tool_outcome_unknown" }))
        const process = await processOf(db)
        const runId = (await customerWrites(process, "Cho minh dat hoa")).runId ?? ""

        const ref = { workspaceId: WS, runId }
        expect((await process.threads.stateOf(ref))?.status).toBe("stopped")
        await redrive(process, runId, "sweep-1")
        await redrive(process, runId, "sweep-2")
        const graph = await process.graphs.pinned(
            ref,
            "chatbot-agent",
            (await process.threads.stateOf(ref))?.version ?? "",
        )
        await expect(process.threads.drive(ref, graph)).resolves.toMatchObject({ status: "stopped" })

        expect(actsOf(db, TOOL.agentTag)).toHaveLength(1)
        const stops = await stopsOf(process, runId)
        expect(stops.map((stop) => [stop.stepKey, stop.state, stop.repeats])).toEqual([["to-consult", "open", 1]])
        expect(stops[0]?.detail.facts.map((fact) => fact.value).join(" ")).toContain("tool_outcome_unknown")
    })
})

// L2-5 (package P8): the host's own agent loop (`AGENT_LOOP=prebuilt:chatbot.answer`: LangChain's prebuilt agent, native tool calls)
// under the same engine rules, on the REAL ledger, the REAL step receipts, the REAL replay and the REAL tries policy.
describe("the prebuilt agent loop under the engine's rules", () => {
    it("retry with no words: the reworded line is answered from the first line's receipt, which satisfies requires", async () => {
        const db = threadDbOf()
        stopsAtAnswer(db)
        const process = await processOf(db, { agentLoop: PREBUILT })
        const runId = (await customerWrites(process, QUESTION)).runId ?? ""
        expect((await process.threads.stateOf({ workspaceId: WS, runId }))?.status).toBe("stopped")
        expect(sendsOf(db)).toEqual([CHECKING])

        db.model.script(ANSWER, send("Shop van dang kiem tra nhe!"), { done: { reply: CHECKING } })
        const ran = await founderDecides(process, runId, button(db, "retry"))

        expect(ran.map((one) => one.error)).toEqual([null])
        // `requires: [nivo.tool.customer.message.send]` is met by the receipt's answer: the output was taken on the second turn.
        expect((await process.threads.stateOf({ workspaceId: WS, runId }))?.status).toBe("ended")
        expect(sendsOf(db)).toEqual([CHECKING])
        expect(db.lines).toHaveLength(1)
        expect(db.model.left(ANSWER)).toBe(0)
        // The model read the receipt's answer (no refusal) as the tool message of its call, on the turn that followed it.
        const [kind, fact] = messagesOf(db.model.askedOf(ANSWER).at(-1)?.request.input).at(-1) ?? ["", ""]
        expect(kind).toBe("tool")
        expect(fact).not.toContain('"ok":false')
        expect(fact).not.toContain("already_told_for_this_stop")
    })

    it("sends the full tool set on every turn, and only appends: each turn's messages open with the previous turn's, byte for byte", async () => {
        const db = threadDbOf()
        db.model.script(UNDERSTAND, { done: { branch: "question", summary: "Lan: gio mo cua" } })
        db.model.script(
            ANSWER,
            { call: { tool: TOOL.brainSearch, args: { query: "gio mo cua" } } },
            send(OUTCOME),
            { done: { reply: OUTCOME } },
        )
        const process = await processOf(db, { agentLoop: PREBUILT })

        await customerWrites(process, QUESTION)

        const turns = db.model.askedOf(ANSWER).map((one) => one.request)
        expect(turns).toHaveLength(3)
        const toolsOf = (input: unknown): unknown => (typeof input === "object" && input !== null ? Reflect.get(input, "tools") : null)
        // The agent's whole set in name order, then done and confused: the same list on every turn, whatever the step may call.
        const [tools] = turns.map((turn) => toolsOf(turn.input))
        expect(tools).toEqual(expect.arrayContaining([TOOL.brainSearch, TOOL.customerMessageSend, "done", "confused"]))
        expect(turns.map((turn) => toolsOf(turn.input))).toEqual([tools, tools, tools])
        expect(new Set(turns.map((turn) => turn.instructions)).size).toBe(1)
        turns.slice(1).forEach((turn, index) => {
            const before = messagesOf(turns[index]?.input)
            expect(messagesOf(turn.input).slice(0, before.length)).toEqual(before)
            expect(messagesOf(turn.input).length).toBeGreaterThan(before.length)
        })
        expect(messagesOf(turns[0]?.input).map(([kind]) => kind)).toEqual(["human"])
    })

    it("kill mid-loop, replay with the recorder: a new process re-asks no turn already answered; the send goes out once", async () => {
        const db = threadDbOf()
        db.model.script(UNDERSTAND, { done: { branch: "question", summary: "Lan: gio mo cua" } })
        db.model.script(ANSWER, { call: { tool: TOOL.brainSearch, args: { query: "gio mo cua" } } })
        const first = await processOf(db, { agentLoop: PREBUILT })
        // The drive of the first process loses its lease while the second turn waits: the first turn and its search are recorded.
        const controller = new AbortController()
        const held = db.model.hold(ANSWER, 1)
        const pending = customerWrites(first, QUESTION, { signal: controller.signal })
        await held.entered
        controller.abort()
        // The node of the old process still runs after its drive was cut: its held turn fails every try and it ends silently.
        const timeout = (): Error => Object.assign(new Error("deadline"), { name: "TimeoutError" })
        db.model.script(ANSWER, timeout(), timeout(), timeout())
        held.release()
        const woken = await pending
        await settledOf(() => db.model.left(ANSWER) === 0)
        await settledOf(() => false, 10)
        expect(String(woken.error)).toContain("Abort")
        const runId = woken.runId ?? ""
        const askedBefore = db.model.askedOf(ANSWER).length
        expect(sendsOf(db)).toEqual([])
        expect(await stopsOf(first, runId)).toEqual([])

        db.model.script(ANSWER, send(OUTCOME), { done: { reply: OUTCOME } })
        const second = await processOf(db, { agentLoop: PREBUILT })
        const ran = await redrive(second, runId, "sweep-1")

        expect(ran.map((one) => one.error)).toEqual([null])
        expect((await second.threads.stateOf({ workspaceId: WS, runId }))?.status).toBe("ended")
        // The re-drive asked the model only for the turns not answered before the cut: the first turn came from the record.
        const again = db.model.askedOf(ANSWER).slice(askedBefore)
        expect(again).toHaveLength(2)
        expect(messagesOf(again[0]?.request.input).map(([kind]) => kind)).toEqual(["human", "ai", "tool"])
        expect(messagesOf(again[1]?.request.input).map(([kind]) => kind)).toEqual(["human", "ai", "tool", "ai", "tool"])
        expect(sendsOf(db)).toEqual([OUTCOME])
        expect(db.lines).toHaveLength(1)
    })
})

/** One step that arms a check-in on the template road (`wdesk.care`), with the care effect granted as a template grants it. (It was the order step; the order tool is removed with the money, wave 4: the same shape, an effect that answers facts and a subject.) */
const careFlow: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: [] },
    grant: {
        tools: [],
        effects: [TOOL.agentTag],
    },
    // The step's ONE mode, as the template adapter writes it on every node step (nivo-frame `rights`): its node's `auto`.
    nodes: [{ key: "care", kind: "output", step: "wdesk.care", mode: "auto", params: {}, input: { leadId: { $ref: "trigger.leadId" } } }],
}

// Defect 3 of the flip: an EFFECT answers a template node its FACTS as `value` (the members a converted node reads, `value.taskId`) and
// the record it wrote in `meta.subject`; the ledger keeps the effect's subject, so a re-run of the step is handed the SAME value and meta.
describe("an effect's facts on the template road, and the ledger's replay of them", () => {
    it("the node reads value.taskId and meta.subject; after a stop the retry is answered by the ledger: the same task, armed once", async () => {
        const db = threadDbOf()
        db.model.script(DESK_CARE, confused)
        db.model.script(CORE, report(null))
        const process = await processOf(db)
        const started = await startThread(process, {
            flow: careFlow,
            versionId: "sales-agent:care@1",
            workflowId: "wf:care",
            trigger: { leadId: LEAD, locale: "vi" },
        })
        expect(started.error).toBeNull()
        const runId = started.runId ?? ""
        expect((await process.threads.stateOf(refOf(runId)))?.status).toBe("stopped")
        expect((await stopsOf(process, runId)).map((stop) => stop.stepKey)).toEqual(["care"])
        // The check-in was armed once; the ledger keeps its subject with the facts the executor answered.
        expect(actsOf(db, TOOL.agentTag)).toHaveLength(1)
        const careRows = () => ledgerOf(db).filter((row) => row.effectId === TOOL.agentTag)
        const taskId = String(careRows()[0]?.subjectId)
        expect(careRows()).toEqual([
            expect.objectContaining({ subjectEntity: "agent-task", subjectId: taskId, facts: expect.objectContaining({ taskId }) }),
        ])
        // Its facts (never `{ kind, id, facts }`) reached the node: the node handed its agent `value.taskId` and `value.dueAt`.
        const toldFirst = JSON.stringify(db.model.askedOf(DESK_CARE)[0]?.request)
        expect(toldFirst).toContain(`"taskId":"${taskId}"`)
        expect(toldFirst).toContain('"dueAt":"2026-11-15T02:00:00.000Z"')

        db.model.script(DESK_CARE, { done: { ok: true } })
        const ran = await founderDecides(process, runId, button(db, "retry"))

        expect(ran.map((one) => one.error)).toEqual([null])
        const state = await process.threads.stateOf(refOf(runId))
        expect(state?.status).toBe("ended")
        // The retry's call was answered by the ledger under the same key: nothing written again, the same value and the same subject.
        expect(actsOf(db, TOOL.agentTag)).toHaveLength(1)
        const told = db.model.askedOf(DESK_CARE).map((one) => JSON.stringify(one.request))
        expect(told).toHaveLength(2)
        expect(told[1]).toContain(`"taskId":"${taskId}"`)
        expect(told[1]).toContain('"dueAt":"2026-11-15T02:00:00.000Z"')
        expect(state?.state.steps.care).toMatchObject({ output: { taskId, subject: `agent-task:${taskId}` } })
        expect(careRows()).toHaveLength(1)
    })
})
