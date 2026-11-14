import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import { CORE_EDGE, NOTE_READ } from "@tests/fixtures/builders/engine-core-plugin.builder"
import { CORE, FRONT, WS, button, founderDecides, rowsOf, startThread, threadDbOf, type ThreadDb } from "./thread-world"
import { coreFlowOf, coreProcessOf, noteActsOf, NOTE_TRIGGER, threadOf } from "./thread-world-core"

// The GENERIC engine core fixture installed beside the core (`engine-core-plugin.builder.ts`), as `version-pin.spec.ts` installs it.
jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const fixture: typeof import("@tests/fixtures/builders/engine-core-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/engine-core-plugin.builder",
    )
    return { installed: parts.installationWith([fixture.CORE_PLUGIN], "engine-core") }
})

// engine-core rule 2 (a run is compiled from the version it started on) across the `ifNode` authoring rename (EF-I, 2026-11-14:
// `ifNode({ then, else })` became `ifNode({ yes, no })`, because an object with a `then` member is a thenable). The rename touched the
// AUTHORING object only: the stored document never carried `then` / `else`. A GraphSpec `@2` writes an `if` as `routes: { yes, no }`,
// and the workflow version row the engine runs holds it as the condition step `core.when` with the same `routes: { yes, no }`. This
// world proves it: the graph of the run is a LITERAL stored row (never built through `ifNode`), the run stops BEFORE its `if`, a NEW
// process (a fresh `processOf(db)` over the same stores: the new build) resumes it, and the `if` takes the right branch on each side.

/** The text that makes the stored `if` hold. */
const YES_TEXT = NOTE_TRIGGER.text

/** The version the run pins (`<agent>:<workflow>@<n>`). */
const VERSION = `${FRONT}:if-edge@1`

/** The `if` exactly as a stored version row holds it (written by hand, NOT by `ifNode`): holds when the trigger's text is `YES_TEXT`. */
const STORED_IF: GraphSpecNode = {
    key: "gate",
    kind: "condition",
    step: "core.when",
    params: { when: { ref: { $ref: "trigger.text" }, op: "eq", value: YES_TEXT } },
    routes: { yes: "second", no: "end" },
}

/** The stored graph: the edge graph `first → check → second → end` with the stored `if` between the check and the second write. */
const storedFlow = (): GraphSpec => {
    const edge = coreFlowOf(CORE_EDGE)
    const nodes = edge.nodes.flatMap((node) => (node.key === "check" ? [{ ...node, next: "gate" }, STORED_IF] : [node]))
    return { ...edge, nodes }
}

/** A database whose check reads `blocked` first (the stop BEFORE the `if`), then clear; the AI core reports the edge. */
const dbOf = (): ThreadDb => {
    const db = threadDbOf()
    const report = {
        decision: "report",
        reason: "Ghi chu dang bi khoa.",
        question: "Lam gi tiep?",
        suggestions: [{ text: "Thu lai", handledBy: "workflow" }],
        customerLine: null,
    }
    db.model.script(CORE, report, report)
    return {
        ...db,
        rights: { ...db.rights, answers: new Map([[NOTE_READ, [{ blocked: true }, { blocked: false }]]]), asked: [] },
    }
}

/** Starts the stored graph with `text`; answers the run stopped at its check. */
const stoppedBeforeIf = async (db: ThreadDb, text: string): Promise<string> => {
    const process = await coreProcessOf(db)
    const woken = await startThread(process, {
        flow: storedFlow(),
        versionId: VERSION,
        trigger: { ...NOTE_TRIGGER, text },
        workflowId: "wf:if-edge",
    })
    return woken.runId ?? ""
}

describe("a run stopped before a stored `if` resumes in a new process and takes the right branch (the stored shape is unchanged)", () => {
    it.each([
        ["yes", YES_TEXT, ["first", "check", "gate", "second", "end"], [YES_TEXT, "second"]],
        ["no", "khong phai", ["first", "check", "gate", "end"], ["khong phai"]],
    ] as const)("the %s side", async (_side, text, steps, written) => {
        const db = dbOf()
        const runId = await stoppedBeforeIf(db, text)
        const first = await coreProcessOf(db)
        expect(await threadOf(first, runId)).toMatchObject({ status: "stopped" })
        expect(Object.keys((await threadOf(first, runId)).steps)).toEqual(["first"])

        const restarted = await coreProcessOf(db)
        const ran = await founderDecides(restarted, runId, button(db, "retry"))

        expect(ran.map((one) => one.error)).toEqual([null])
        const view = await restarted.threads.stateOf({ workspaceId: WS, runId })
        expect(view).toMatchObject({ version: VERSION, status: "ended" })
        expect(Object.keys(view?.state.steps ?? {})).toEqual(steps)
        expect(rowsOf(db, runId).steps.map((step) => step.stepKey)).toEqual(steps)
        expect(noteActsOf(db).map((act) => act.payload.text)).toEqual(written)
        // The pinned row is the literal one: the `if` is stored with `routes: { yes, no }` and no `then` / `else` member.
        const stored = db.versions.get(VERSION)?.flow.nodes.find((node) => node.key === "gate")
        expect(stored).toEqual(STORED_IF)
        expect(stored).not.toHaveProperty("then")
        expect(stored).not.toHaveProperty("else")
    })
})
