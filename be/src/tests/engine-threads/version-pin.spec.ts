import { TOOL } from "@nivo-lite/blocks-core"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { AgentThreadsErrorCode } from "@modules/domain/agent-threads"
import { LanggraphErrorCode } from "@modules/integrations/langgraph"
import {
    ANSWER,
    CONV,
    CORE,
    FRONT,
    UNDERSTAND,
    WS,
    answer,
    customerWrites,
    founderDecides,
    frontDeskFlow,
    frontDeskVersion,
    processOf,
    rowsOf,
    stopsOf,
    threadDbOf,
    type ThreadDb,
} from "./thread-world"

// Package 0-9, item 5 (design risk 3): a run started on template version N resumes on N after N+1 is published, also in a process
// that never built N; resuming it on another version is refused by name; a pinned version whose step is not installed is refused by
// name and the run reads failed (never a silent end).

const OUTCOME = "Shop mo cua tu 8h den 21h a."

/** Version N+1 of the front desk: the answer step renamed `reply`. A thread pinned to N must never run it. */
const renamed = (flow: GraphSpec): GraphSpec => ({
    ...flow,
    nodes: flow.nodes.map((node) =>
        node.key === "understand"
            ? { ...node, routes: { ...node.routes, question: "reply" } }
            : node.key === "answer"
              ? { ...node, key: "reply" }
              : node,
    ),
})

const stoppedOnN = async (db: ThreadDb) => {
    db.model.script(UNDERSTAND, { answer: { branch: "question", summary: "Lan: gio mo cua" } })
    db.model.script(ANSWER, { confused: { reason: "Khong ro gio mo cua", question: "Shop mo may gio?" } })
    db.model.script(CORE, {
        decision: "report",
        reason: "Khong ro gio mo cua.",
        question: "Shop mo may gio?",
        suggestions: [
            { text: "8h-21h", handledBy: "workflow" },
            { text: "Toi tu tra loi", handledBy: "person" },
        ],
        customerLine: null,
    })
    const process = await processOf(db)
    const runId = (await customerWrites(process, "Shop mo cua may gio?")).runId ?? ""
    const versionN = frontDeskVersion(db)
    const number = db.versions.get(versionN)?.number ?? 0
    const versionNext = versionN.replace(/@\d+$/, `@${number + 1}`)
    db.versions.set(versionNext, { number: number + 1, flow: renamed(frontDeskFlow()) })
    return { runId, versionN, versionNext }
}

describe("a thread is pinned to the version it started on", () => {
    it("resumes on N after N+1 is published, in a process that never built N; the step of N runs", async () => {
        const db = threadDbOf()
        const { runId, versionN } = await stoppedOnN(db)

        const restarted = await processOf(db)
        db.model.script(
            ANSWER,
            { call: { tool: TOOL.customerMessageSend, args: { conversationId: CONV, text: OUTCOME } } },
            { done: { reply: OUTCOME } },
        )
        const ran = await founderDecides(restarted, runId, answer(db, "8h-21h"))

        expect(ran.map((one) => one.error)).toEqual([null])
        const view = await restarted.threads.stateOf({ workspaceId: WS, runId })
        expect(view).toMatchObject({ version: versionN, status: "ended" })
        expect(Object.keys(view?.state.steps ?? {})).toEqual(["understand", "answer"])
        expect(rowsOf(db, runId).steps.map((step) => step.stepKey)).toEqual(["understand", "answer"])
    })

    it("refuses by name to resume or drive the thread on the graph of another version", async () => {
        const db = threadDbOf()
        const { runId, versionNext } = await stoppedOnN(db)
        const process = await processOf(db)
        const ref = { workspaceId: WS, runId }
        const next = await process.graphs.pinned(ref, FRONT, versionNext)

        await expect(process.threads.resume(ref, next, answer(db, "8h-21h"))).rejects.toMatchObject({
            code: LanggraphErrorCode.VersionMismatch,
        })
        await expect(process.threads.drive(ref, next)).rejects.toMatchObject({
            code: LanggraphErrorCode.VersionMismatch,
        })
        expect((await process.threads.stateOf(ref))?.status).toBe("stopped")
    })

    it("refuses by name a pinned version whose step is not installed: the run reads failed, its stop closes with it, nothing runs", async () => {
        const db = threadDbOf()
        const { runId, versionN } = await stoppedOnN(db)
        const found = { number: db.versions.get(versionN)?.number ?? 0, flow: frontDeskFlow() }
        // A release of blocks-core removed the node the pinned version names (the process has never built that version).
        db.versions.set(versionN, {
            number: found.number,
            flow: {
                ...found.flow,
                nodes: found.flow.nodes.map((node) =>
                    node.key === "answer" ? { ...node, step: "chatbot.gone" } : node,
                ),
            },
        })
        const restarted = await processOf(db)

        await expect(restarted.graphs.pinned({ workspaceId: WS, runId }, FRONT, versionN)).rejects.toMatchObject({
            code: AgentThreadsErrorCode.TemplateRefused,
            params: { problem: "TEMPLATE_STEP_UNKNOWN" },
        })
        expect(rowsOf(db, runId).run).toMatchObject({ status: "failed" })
        // N-0-9-2 (fixed): the stop of the run does not stay open with live buttons on a failed run; its card is rewritten as resolved.
        expect((await stopsOf(restarted, runId)).map((stop) => stop.state)).toEqual(["resolved"])
        expect(db.team[0]?.versions.at(-1)).toMatchObject({
            kind: "workflow.stopped",
            rewrite: { stop: { state: "resolved", resolvedAt: expect.any(String) } },
        })
    })
})
