import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import { requireSoundFlow, sameFlow, templateFlowProblems } from "@modules/domain/agent-graphs/policies/flow.policy"
import { graphWithNodeMode } from "@modules/domain/agent-graphs/policies/node-mode-override.policy"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { CORE_WRITE_AUTO, NOTE_WRITE } from "@tests/fixtures/builders/engine-core-plugin.builder"
import { WS, drain, itemsOf, stopsOf, startThread, threadDbOf, type ThreadDb, type ThreadProcess } from "./thread-world"
import { NOTE_TRIGGER, coreFlowOf, coreProcessOf, noteActsOf, threadOf, workflowIdOf } from "./thread-world-core"

// The GENERIC engine core fixture installed beside the core (`engine-core-plugin.builder.ts`): its write graph is an installed template graph.
jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const fixture: typeof import("@tests/fixtures/builders/engine-core-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/engine-core-plugin.builder",
    )
    return { installed: parts.installationWith([fixture.CORE_PLUGIN], "engine-core") }
})

// E-FIX8, the SECOND kind of workflow for the rule of `node-mode-setting.spec.ts` (R75): a node step's mode is the shop's setting on its
// copy of a template graph. Here no person and no line: one record write (a test double of the engine core fixture). The shop sets the
// write step of the installed graph to `ask`: the save takes it as the template's copy, a run pinned to it stops for a yes and the yes
// writes once; set back to `auto` the graph is the template's own again and a run writes with no stop.

const INDEX = nodeIndexOf(INSTALLED.nodeInstall())

/** What the owner door treats as an engine control step (the admin service's own test). */
const isControl = (step: string): boolean => INSTALLED.stepOf(step)?.control === true

/** The owner door's change of the write step's mode, then the store's round trip (the stored document is JSON). */
const set = (graph: GraphSpec, mode: "auto" | "ask"): GraphSpec => {
    const changed = graphWithNodeMode(graph, "write", mode, isControl)
    if (changed === null) throw new Error("the mode did not change")
    const stored: GraphSpec = JSON.parse(JSON.stringify(changed))
    return stored
}

/** One run of the write graph pinned to `flow` as version `number` of its workflow. */
const runOn = async (db: ThreadDb, flow: GraphSpec, number: number): Promise<{ process: ThreadProcess; runId: string }> => {
    const process = await coreProcessOf(db)
    const woken = await startThread(process, {
        flow,
        versionId: `${CORE_WRITE_AUTO}@${number}`,
        trigger: NOTE_TRIGGER,
        workflowId: workflowIdOf(CORE_WRITE_AUTO),
    })
    expect(woken.error).toBeNull()
    return { process, runId: woken.runId ?? "" }
}

describe("a node's mode set by the shop on a write graph (no person, no line)", () => {
    it("the installed graph with its write set to ask saves as the template's copy; set back it is the template's own graph", () => {
        const asking = set(coreFlowOf(CORE_WRITE_AUTO), "ask")

        expect(templateFlowProblems(asking)).toEqual([])
        expect(() => requireSoundFlow(asking, INDEX)).not.toThrow()
        expect(sameFlow(coreFlowOf(CORE_WRITE_AUTO), set(asking, "auto"))).toBe(true)
    })

    it("pinned to the `ask` version: one approval, nothing written; the yes writes once with the approver", async () => {
        const db = threadDbOf()
        const { process, runId } = await runOn(db, set(coreFlowOf(CORE_WRITE_AUTO), "ask"), 2)

        expect((await stopsOf(process, runId)).map((stop) => [stop.stepKey, stop.kind, stop.state])).toEqual([["write", "approval", "open"]])
        expect(noteActsOf(db)).toEqual([])

        const from = db.wakes.length
        const workItemId = itemsOf(db)[0]?.item.id ?? ""
        const admitted = await process.approvals?.decided(
            { workspaceId: WS, runId, stepKey: "write", workItemId, verdict: "approved", by: "owner-1", text: "" },
            process.requests,
        )
        expect(admitted).toMatchObject({ kind: "admitted" })
        await drain(process, from)

        expect(noteActsOf(db).map((act) => [act.effect, act.approvedBy])).toEqual([[NOTE_WRITE, "owner-1"]])
        expect((await threadOf(process, runId)).status).toBe("ended")
    })

    it("pinned to the version set back to auto: the write runs with no stop", async () => {
        const db = threadDbOf()
        const { process, runId } = await runOn(db, set(set(coreFlowOf(CORE_WRITE_AUTO), "ask"), "auto"), 3)

        expect(await stopsOf(process, runId)).toEqual([])
        expect(itemsOf(db)).toEqual([])
        expect(noteActsOf(db).map((act) => [act.effect, act.approvedBy])).toEqual([[NOTE_WRITE, null]])
        expect((await threadOf(process, runId)).status).toBe("ended")
    })
})
