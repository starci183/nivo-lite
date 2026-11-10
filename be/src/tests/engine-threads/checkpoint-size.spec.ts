import { TOOL } from "@nivo-lite/blocks-core"
import {
    ANSWER,
    CONV,
    CORE,
    UNDERSTAND,
    WS,
    customerWrites,
    processOf,
    rowsOf,
    stopsOf,
    threadDbOf,
} from "./thread-world"

// Package 0-9, item 9 (design risk 2, the spec 0-2 dropped): a step whose state would exceed the checkpoint ceiling is stopped by the engine
// for the founder before anything of it is written; the saver's own refusal (`LANGGRAPH_CHECKPOINT_TOO_LARGE`) stays the backstop.

const LIMITS = { warnBytes: 2_000, maxBytes: 8_000, listMax: 1000 }
const LONG = "Shop mo cua tu 8h den 21h. ".repeat(400)

describe("the checkpoint size ceiling", () => {
    it("stops a step whose output is over the limit for the founder (an engine stop); nothing over the limit is stored", async () => {
        const db = threadDbOf()
        db.model.script(UNDERSTAND, { answer: { branch: "question", summary: "Lan: gio mo cua" } })
        db.model.script(
            ANSWER,
            { call: { tool: TOOL.customerMessageSend, args: { conversationId: CONV, text: "Shop mo cua 8h-21h a." } } },
            { done: { reply: LONG } },
        )
        const process = await processOf(db, { limits: LIMITS })

        const woken = await customerWrites(process, "Shop mo cua may gio?")

        expect(LONG.length).toBeGreaterThan(LIMITS.maxBytes)
        // N-0-9-1 (fixed): the node measures its output against the ceiling before writing anything and stops the step itself, so the
        // checkpoint never refuses it: the thread waits at the gate with an engine stop and one card; the AI core is not asked.
        expect(woken.error).toBeNull()
        const runId = woken.runId ?? ""
        const stored = db.checkpoints.rowsOf(runId)
        expect(Math.max(...stored.map((one) => one.row.payload.byteLength))).toBeLessThanOrEqual(LIMITS.maxBytes)
        const view = await process.threads.stateOf({ workspaceId: WS, runId })
        expect(view?.status).toBe("stopped")
        expect(Object.keys(view?.state.steps ?? {})).toEqual(["understand"])
        const [stop, ...none] = await stopsOf(process, runId)
        expect(none).toEqual([])
        expect(stop).toMatchObject({ stepKey: "answer", kind: "engine", state: "open" })
        expect(stop?.detail.facts).toEqual(
            expect.arrayContaining([expect.objectContaining({ value: "step_output_too_large" })]),
        )
        expect(db.team).toHaveLength(1)
        expect(db.model.askedOf(CORE)).toHaveLength(0)
        expect(rowsOf(db, runId).steps.map((step) => [step.stepKey, step.status])).toEqual([
            ["understand", "done"],
            ["answer", "failed"],
        ])
        expect(rowsOf(db, runId).run).toMatchObject({ status: "waiting" })
    })

    it("keeps a step under the limit (the same walk with a short reply ends) and the thread small", async () => {
        const db = threadDbOf()
        db.model.script(UNDERSTAND, { answer: { branch: "question", summary: "Lan: gio mo cua" } })
        db.model.script(
            ANSWER,
            { call: { tool: TOOL.customerMessageSend, args: { conversationId: CONV, text: "Shop mo cua 8h-21h a." } } },
            { done: { reply: "Shop mo cua 8h-21h a." } },
        )
        const process = await processOf(db, { limits: LIMITS })

        const woken = await customerWrites(process, "Shop mo cua may gio?")

        expect(woken.error).toBeNull()
        expect((await process.threads.stateOf({ workspaceId: WS, runId: woken.runId ?? "" }))?.status).toBe("ended")
        // Growth (design risk 2): the two-step walk keeps a handful of rows and a few kilobytes per thread.
        const usage = await db.checkpoints.port.usage(WS, woken.runId ?? "")
        expect(usage.checkpoints).toBeLessThanOrEqual(6)
        expect(usage.bytes).toBeLessThan(16 * 1024)
    })
})
