import { INSTALLED } from "@modules/domain/installed-plugins"
import { ROUTES_SORT } from "@tests/fixtures/builders/route-reach-plugin.builder"
import { FRONT, processOf, startThread, threadDbOf, type ThreadDb } from "./thread-world"
import { threadOf } from "./thread-world-core"
import { reachProvidersOf } from "./thread-world-reach"

// E-SMALL item 1, the SECOND KIND (R75): a note workflow (no person, no channel, no model) whose routing node reads `ctx.run.unreachable`.
// RULE (engine words): a step's route is closed when every road it leads to (through the engine's conditions and hand-backs) ends at a
// workflow call this workspace cannot start (no agent of the module, or no live registration of the workflow); the engine names those
// routes to the node, and only those. The exposing case (the front desk's `book` with no booking agent) is `front-desk-reach.spec.ts`.

jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const fixture: typeof import("@tests/fixtures/builders/route-reach-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/route-reach-plugin.builder",
    )
    return { installed: parts.installationWith([fixture.ROUTES_PLUGIN], "route-reach") }
})

const flowOf = () => {
    const graph = INSTALLED.templateOf(ROUTES_SORT)?.versions[0]?.graph
    if (graph === undefined) throw new Error("fixture graph missing")
    return graph
}

/** Starts the sort workflow on a process of `db` (with the engine's reach bound for `modules`, or none) and answers its sort step. */
const sorted = async (db: ThreadDb, modules: Readonly<Record<string, string>> | null) => {
    const process = await processOf(db, modules === null ? {} : { extra: reachProvidersOf(db, modules) })
    const woken = await startThread(process, {
        flow: flowOf(),
        versionId: `${ROUTES_SORT}@1`,
        trigger: { noteId: "n-1" },
        workflowId: `wf:${ROUTES_SORT}`,
    })
    if (woken.error !== null) throw woken.error
    const { steps } = await threadOf(process, woken.runId ?? "")
    return { steps: steps as Readonly<Record<string, { readonly output?: unknown }>>, db }
}

describe("run.unreachable, a note workflow (second kind)", () => {
    it("the agent's own live workflow keeps `file` open; `post` (every road through the condition calls a module nobody runs) is closed", async () => {
        const modules = { [FRONT]: "troutes" }
        const { steps, db } = await sorted(threadDbOf({ modules }), modules)
        expect(steps.sort?.output).toEqual({ route: "file", closed: ["post"] })
        // The open road was followed: the call of the live workflow went out, nothing else.
        expect(db.acts.filter((act) => act.effect === "nivo.tool.agent.tag")).toHaveLength(1)
    })

    it("with no agent of the module installed, the call to it is closed too: the node takes the only open route", async () => {
        const modules = { [FRONT]: "troutes" }
        // The reach answers for a workspace whose installation runs no `troutes` agent (the graph still runs on its pin).
        const { steps, db } = await sorted(threadDbOf({ modules }), { other: "tother" })
        expect(steps.sort?.output).toEqual({ route: "drop", closed: ["file", "post"] })
        expect(db.acts.filter((act) => act.effect === "nivo.tool.agent.tag")).toHaveLength(0)
    })

    it("an app that binds no reach names no route: every route stays open, as before", async () => {
        const modules = { [FRONT]: "troutes" }
        const { steps } = await sorted(threadDbOf({ modules }), null)
        expect(steps.sort?.output).toEqual({ route: "file", closed: [] })
    })
})
