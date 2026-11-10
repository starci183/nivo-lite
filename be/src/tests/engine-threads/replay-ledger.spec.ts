import { TOOL } from "@nivo-lite/blocks-core"
import {
    ANSWER,
    CONV,
    CORE,
    FRONT_DESK,
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
    stopsOf,
    threadDbOf,
    type ThreadDb,
} from "./thread-world"

// Package 0-9, items 2 and 3: the REAL effect ledger (GraphNodeEffectsService over the records) and the REAL per-stop repeat guard
// (NodeToolDoorService.repeatGuard) under the REAL replay of LangGraph tasks (replayPortsOf through GraphNodeHostService), never a
// stand-in. "Once" is counted at the outside world: every act that reached the fake channel.

const QUESTION = "Shop mo cua may gio?"
const CHECKING = "Shop dang kiem tra gio mo cua, ban doi chut a."
const OUTCOME = "Shop mo cua tu 8h den 21h a."

const send = (text: string) => ({ call: { tool: TOOL.customerMessageSend, args: { conversationId: CONV, text } } })

/** The log event of a restarted node that leaves its record (`LanggraphLogEvent.ReplayLeft`). */
const REPLAY_LEFT = "langgraph.replay.left"

/** The node whose agent's turns the host's own loop takes in the prebuilt-loop cases (`AGENT_LOOP=prebuilt:chatbot.answer`). */
const PREBUILT = ["chatbot.answer"]

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
    db.model.script(UNDERSTAND, { answer: { branch: "question", summary: "Lan: gio mo cua" } })
    db.model.script(ANSWER, ...(options.sendsFirst === false ? [] : [send(CHECKING)]), confused)
    db.model.script(CORE, report(options.holdingLine ?? null))
}

const started = async (db: ThreadDb) => {
    const process = await processOf(db, { flag: [FRONT_DESK] })
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
        const keys = ledgerOf(db).map((row) => String(row.effectKey))
        expect(keys.filter((key) => key.startsWith(`call:${runId}:answer:`))).toHaveLength(2)
        // The founder's words reached the step's model request.
        expect(JSON.stringify(db.model.askedOf(ANSWER).at(-1)?.request)).toContain("Shop mo 8h den 21h")
    })

    it("retry with no words: the identical line replays from the ledger, a reworded one is refused by the guard; one line", async () => {
        const db = threadDbOf()
        stopsAtAnswer(db)
        const { process, runId } = await started(db)

        db.model.script(ANSWER, send(CHECKING), send("Shop van dang kiem tra nhe!"), { done: { reply: CHECKING } })
        const ran = await founderDecides(process, runId, button(db, "retry"))

        expect(ran.map((one) => one.error)).toEqual([null])
        expect((await process.threads.stateOf({ workspaceId: WS, runId }))?.status).toBe("ended")
        expect(sendsOf(db)).toEqual([CHECKING])
        expect(db.lines).toHaveLength(1)
        // The model was shown the refusal fact of the guard for the reworded line.
        const last = JSON.stringify(db.model.askedOf(ANSWER).at(-1)?.request)
        expect(last).toContain("already_told_for_this_stop")
    })

    it("the AI core's holding line counts as the stop's line: after a retry the step's own line is refused; one line", async () => {
        const db = threadDbOf()
        stopsAtAnswer(db, { sendsFirst: false, holdingLine: CHECKING })
        const { process, runId } = await started(db)
        expect(sendsOf(db)).toEqual([CHECKING])
        expect(actsOf(db, TOOL.customerMessageSend)[0]?.key).toBe(`honest-line:${runId}:answer`)
        const [stop] = await stopsOf(process, runId)
        expect(stop?.customerLines.map((line) => line.text)).toEqual([CHECKING])

        db.model.script(ANSWER, send("Da, shop dang xem lai gio mo cua."), { done: { reply: CHECKING } })
        await founderDecides(process, runId, button(db, "retry"))

        expect(sendsOf(db)).toEqual([CHECKING])
        expect(db.lines).toHaveLength(1)
    })

    it("a different line after an answer goes out once, also when the thread is driven again afterwards", async () => {
        const db = threadDbOf()
        stopsAtAnswer(db)
        const { process, runId } = await started(db)
        db.model.script(ANSWER, send(OUTCOME), { done: { reply: OUTCOME } })
        await founderDecides(process, runId, answer(db, "8h-21h"))

        const again = await processOf(db, { flag: [FRONT_DESK] })
        await expect(redrive(again, runId, "sweep-1")).rejects.toMatchObject({ params: { why: "thread_ended" } })
        expect(sendsOf(db)).toEqual([CHECKING, OUTCOME])
    })
})

describe("kill and replay (item 3)", () => {
    /** The question route, its answer step sending one line and completing. */
    const answers = (db: ThreadDb, times = 1) => {
        db.model.script(UNDERSTAND, { answer: { branch: "question", summary: "Lan: gio mo cua" } })
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
            if (mutation.entity !== "agent.run-step" || mutation.op !== "update" || mutation.values.status !== "done")
                return false
            done += 1
            return done === 2
        })
    }

    it("a crash between the act and the checkpoint: a new process drives the thread on and nothing is sent twice", async () => {
        const db = threadDbOf()
        answers(db, 2)
        crashesAfterTheSend(db)
        const first = await processOf(db, { flag: [FRONT_DESK] })
        const woken = await customerWrites(first, QUESTION)
        expect(String(woken.error)).toContain("WORLD_PROCESS_DIED")
        const runId = woken.runId ?? ""
        expect(sendsOf(db)).toEqual([OUTCOME])
        expect((await first.threads.stateOf({ workspaceId: WS, runId }))?.status).toBe("open")

        const second = await processOf(db, { flag: [FRONT_DESK] })
        const ran = await redrive(second, runId, "sweep-1")

        expect(ran.map((one) => one.error)).toEqual([null])
        expect((await second.threads.stateOf({ workspaceId: WS, runId }))?.status).toBe("ended")
        expect(sendsOf(db)).toEqual([OUTCOME])
        expect(db.lines).toHaveLength(1)
        expect(db.model.askedOf(UNDERSTAND)).toHaveLength(1)
    })

    // DOCUMENTED COST (D-0-9-1, accepted by the coordinator 2026-11-10, not a defect): the replay of model calls goes by request
    // CONTENT, and `chatbot.answer` (like every agent step that reads its conversation) reads the line it sent itself before the crash,
    // so after a crash mid-step the whole step runs live again (`langgraph.replay.left`, why `asks-another`, position 0). Measured here:
    // the answer step's 3 model turns are asked again (6 in all instead of 3); the ledger keeps the send at one. Replaying a stale model
    // decision would be worse. The live walk's kill-mid-step check (0-10) should expect these extra turns.
    it("cost D-0-9-1: after a crash mid-step an agent step that reads its conversation asks the model all its turns again (3 → 6)", async () => {
        const db = threadDbOf()
        answers(db, 2)
        crashesAfterTheSend(db)
        const first = await processOf(db, { flag: [FRONT_DESK] })
        const runId = (await customerWrites(first, QUESTION)).runId ?? ""
        expect(db.model.askedOf(ANSWER)).toHaveLength(3)

        const second = await processOf(db, { flag: [FRONT_DESK] })
        await redrive(second, runId, "sweep-1")

        // The first turn of the re-run reads the line the step sent before the crash: another request, so the record is left there.
        const [before, after] = [db.model.askedOf(ANSWER)[0], db.model.askedOf(ANSWER)[3]]
        expect(JSON.stringify(before?.request.input)).not.toContain(OUTCOME)
        expect(JSON.stringify(after?.request.input)).toContain(OUTCOME)
        expect(second.logger.warn).toHaveBeenCalledWith(REPLAY_LEFT, { thread: runId, position: 0, why: "asks-another" })
        expect(db.model.askedOf(ANSWER)).toHaveLength(6)
        // The cost is model turns only: the send stays at one, by the ledger.
        expect(sendsOf(db)).toEqual([OUTCOME])
        expect(db.lines).toHaveLength(1)
    })

    it("the task records lost too: the step runs live again, the ledger alone keeps the send at one", async () => {
        const db = threadDbOf()
        answers(db, 2)
        crashesAfterTheSend(db)
        const first = await processOf(db, { flag: [FRONT_DESK] })
        const runId = (await customerWrites(first, QUESTION)).runId ?? ""

        db.forgetTaskWrites = true
        const second = await processOf(db, { flag: [FRONT_DESK] })
        const ran = await redrive(second, runId, "sweep-1")

        expect(ran.map((one) => one.error)).toEqual([null])
        expect(db.model.askedOf(ANSWER)).toHaveLength(6)
        expect(sendsOf(db)).toEqual([OUTCOME])
        expect(db.lines).toHaveLength(1)
    })
})

/** The drive of the first process loses its lease (the signal aborts) after the answer step's send acted, while its next turn waits. */
const abortedAfterTheSend = async (db: ThreadDb) => {
    db.model.script(UNDERSTAND, { answer: { branch: "question", summary: "Lan: gio mo cua" } })
    db.model.script(ANSWER, send(OUTCOME))
    const first = await processOf(db, { flag: [FRONT_DESK] })
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
        expect((await (await processOf(db, { flag: [] })).threads.stateOf({ workspaceId: WS, runId }))?.status).toBe(
            "open",
        )

        db.model.script(ANSWER, send(OUTCOME), { done: { reply: OUTCOME } })
        const second = await processOf(db, { flag: [FRONT_DESK] })
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
        db.model.script(UNDERSTAND, { answer: { branch: "buy", summary: "Lan: buy" } })
        db.model.script(CORE, report(null))
        db.throwOn.set(TOOL.agentTag, Object.assign(new Error("tag sent, no answer"), { code: "tool_outcome_unknown" }))
        const process = await processOf(db, { flag: [FRONT_DESK] })
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
// under the same engine rules, on the REAL ledger, the REAL per-stop guard, the REAL replay and the REAL tries policy.
describe("the prebuilt agent loop under the engine's rules", () => {
    it("retry with no words: the identical line replays from the ledger; the reworded one is refused already_told_for_this_stop, which satisfies requires", async () => {
        const db = threadDbOf()
        stopsAtAnswer(db)
        const process = await processOf(db, { flag: [FRONT_DESK], agentLoop: PREBUILT })
        const runId = (await customerWrites(process, QUESTION)).runId ?? ""
        expect((await process.threads.stateOf({ workspaceId: WS, runId }))?.status).toBe("stopped")
        expect(sendsOf(db)).toEqual([CHECKING])

        db.model.script(ANSWER, send(CHECKING), send("Shop van dang kiem tra nhe!"), { done: { reply: CHECKING } })
        const ran = await founderDecides(process, runId, button(db, "retry"))

        expect(ran.map((one) => one.error)).toEqual([null])
        // `requires: [customer.message.send]` is met by the guard's refusal: the output was taken on the third turn of the visit.
        expect((await process.threads.stateOf({ workspaceId: WS, runId }))?.status).toBe("ended")
        expect(sendsOf(db)).toEqual([CHECKING])
        expect(db.lines).toHaveLength(1)
        expect(db.model.left(ANSWER)).toBe(0)
        // The model read the refusal as the tool message of its call, on the turn that followed it.
        const [kind, fact] = messagesOf(db.model.askedOf(ANSWER).at(-1)?.request.input).at(-1) ?? ["", ""]
        expect(kind).toBe("tool")
        expect(fact).toContain('"ok":false')
        expect(fact).toContain("already_told_for_this_stop")
    })

    it("sends the full tool set on every turn, and only appends: each turn's messages open with the previous turn's, byte for byte", async () => {
        const db = threadDbOf()
        db.model.script(UNDERSTAND, { answer: { branch: "question", summary: "Lan: gio mo cua" } })
        db.model.script(
            ANSWER,
            { call: { tool: TOOL.brainSearch, args: { query: "gio mo cua" } } },
            send(OUTCOME),
            { done: { reply: OUTCOME } },
        )
        const process = await processOf(db, { flag: [FRONT_DESK], agentLoop: PREBUILT })

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
        db.model.script(UNDERSTAND, { answer: { branch: "question", summary: "Lan: gio mo cua" } })
        db.model.script(ANSWER, { call: { tool: TOOL.brainSearch, args: { query: "gio mo cua" } } })
        const first = await processOf(db, { flag: [FRONT_DESK], agentLoop: PREBUILT })
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
        const second = await processOf(db, { flag: [FRONT_DESK], agentLoop: PREBUILT })
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
