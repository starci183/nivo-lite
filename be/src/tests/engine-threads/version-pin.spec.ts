import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { AgentThreadsErrorCode } from "@modules/domain/agent-threads"
import { LanggraphErrorCode } from "@modules/integrations/langgraph"
import { CORE_EDGE, NOTE_READ } from "@tests/fixtures/builders/engine-core-plugin.builder"
import { CORE, FRONT, WS, button, founderDecides, rowsOf, startThread, stopsOf, threadDbOf, type ThreadDb } from "./thread-world"
import { coreFlowOf, coreProcessOf, NOTE_TRIGGER } from "./thread-world-core"

// The GENERIC engine core fixture installed beside the core (`engine-core-plugin.builder.ts`; moved off the world's business desk by
// worker E: the same facts, on the generic edge graph `write → check → second write → outcome`).
jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const fixture: typeof import("@tests/fixtures/builders/engine-core-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/engine-core-plugin.builder",
    )
    return { installed: parts.installationWith([fixture.CORE_PLUGIN], "engine-core") }
})

// Package 0-9, item 5 (design risk 3): a run started on template version N resumes on N after N+1 is published, also in a process
// that never built N; resuming it on another version is refused by name; a pinned version whose step is not installed is refused by
// name and the run reads failed (never a silent end).

/** Version N of the edge graph, as the run pins it (`<agent>:<workflow>@<n>`). */
const VERSION_N = `${FRONT}:edge@1`

/** Version N+1 of the edge graph: the check step renamed `verify`. A thread pinned to N must never run it. */
const renamed = (flow: GraphSpec): GraphSpec => ({
    ...flow,
    nodes: flow.nodes.map((node) =>
        node.key === "first"
            ? { ...node, routes: { ...node.routes, done: "verify" } }
            : node.key === "check"
              ? { ...node, key: "verify" }
              : node,
    ),
})

/** A database whose door answers the check's read from a script: `blocked` first (the edge), then clear. */
const dbOf = (): ThreadDb => {
    const db = threadDbOf()
    return { ...db, rights: { ...db.rights, answers: new Map([[NOTE_READ, [{ blocked: true }, { blocked: false }]]]), asked: [] } }
}

const stoppedOnN = async (db: ThreadDb) => {
    db.model.script(CORE, {
        decision: "report",
        reason: "Ghi chu dang bi khoa.",
        question: "Lam gi tiep?",
        suggestions: [{ text: "Thu lai", handledBy: "workflow" }],
        customerLine: null,
    })
    const process = await coreProcessOf(db)
    const woken = await startThread(process, { flow: coreFlowOf(CORE_EDGE), versionId: VERSION_N, trigger: NOTE_TRIGGER, workflowId: "wf:direct" })
    const runId = woken.runId ?? ""
    const versionNext = `${FRONT}:edge@2`
    db.versions.set(versionNext, { number: 2, flow: renamed(coreFlowOf(CORE_EDGE)) })
    return { runId, versionN: VERSION_N, versionNext }
}

describe("a thread is pinned to the version it started on", () => {
    it("resumes on N after N+1 is published, in a process that never built N; the step of N runs", async () => {
        const db = dbOf()
        const { runId, versionN } = await stoppedOnN(db)

        const restarted = await coreProcessOf(db)
        const ran = await founderDecides(restarted, runId, button(db, "retry"))

        expect(ran.map((one) => one.error)).toEqual([null])
        const view = await restarted.threads.stateOf({ workspaceId: WS, runId })
        expect(view).toMatchObject({ version: versionN, status: "ended" })
        expect(Object.keys(view?.state.steps ?? {})).toEqual(["first", "check", "second", "end"])
        expect(rowsOf(db, runId).steps.map((step) => step.stepKey)).toEqual(["first", "check", "second", "end"])
    })

    it("refuses by name to resume or drive the thread on the graph of another version", async () => {
        const db = dbOf()
        const { runId, versionNext } = await stoppedOnN(db)
        const process = await coreProcessOf(db)
        const ref = { workspaceId: WS, runId }
        const next = await process.graphs.pinned(ref, FRONT, versionNext)

        await expect(process.threads.resume(ref, next, button(db, "retry"))).rejects.toMatchObject({
            code: LanggraphErrorCode.VersionMismatch,
        })
        await expect(process.threads.drive(ref, next)).rejects.toMatchObject({
            code: LanggraphErrorCode.VersionMismatch,
        })
        expect((await process.threads.stateOf(ref))?.status).toBe("stopped")
    })

    it("refuses by name a pinned version whose step is not installed: the run reads failed, its stop closes with it, nothing runs", async () => {
        const db = dbOf()
        const { runId, versionN } = await stoppedOnN(db)
        const found = { number: db.versions.get(versionN)?.number ?? 0, flow: coreFlowOf(CORE_EDGE) }
        // A release of the package removed the node the pinned version names (the process has never built that version).
        db.versions.set(versionN, {
            number: found.number,
            flow: { ...found.flow, nodes: found.flow.nodes.map((node) => (node.key === "check" ? { ...node, step: "tcore.gone" } : node)) },
        })
        const restarted = await coreProcessOf(db)

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
