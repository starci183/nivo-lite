import { callInputsOf } from "@nivo-lite/agent-sdk/graph"
import { defineInstallation } from "@nivo-lite/agent-sdk/installation"
import type { TemplateGraph } from "@nivo-lite/agent-sdk/template"
import { corePlugin } from "@nivo-lite/blocks-core"
import { plugin } from "./plugin"

/** The installation the engine is wired from: this plugin composed with the core package (its template agents included). */
const installed = defineInstallation([corePlugin, plugin], "")
/** Every graph of the installation by key, with the agent that ships it: a hand-off may target a graph of any package. */
const graphs = new Map<string, { readonly agent: string; readonly graph: TemplateGraph }>(
    installed.templateAgents.flatMap((agent) =>
        agent.graphs.map((graph) => [graph.key, { agent: agent.key, graph }] as const),
    ),
)

/** One end hand-off of a graph of this plugin: who calls, the agent and the workflow it names, the inputs it maps. */
interface HandOff {
    readonly from: string
    readonly agent: string
    readonly target: string
    readonly inputs: ReadonlyArray<string>
}

const handOffs: ReadonlyArray<HandOff> = (plugin.templateAgents ?? []).flatMap((agent) =>
    agent.graphs.flatMap((graph) =>
        graph.spec.nodes.flatMap((step): ReadonlyArray<HandOff> =>
            step.kind === "call-workflow"
                ? [
                      {
                          from: `${graph.key}#${step.key}`,
                          agent: step.params.agent,
                          target: `${step.params.agent}.${step.params.workflow}`,
                          inputs: Object.keys(step.params.inputs),
                      },
                  ]
                : [],
        ),
    ),
)

describe("the hand-offs between the NIVO Web agents", () => {
    it("exist (the renewal chain, the mail hand-offs, the front door's and the close's are drawn)", () => {
        expect(handOffs.length).toBeGreaterThan(0)
    })

    it.each(handOffs.map((one) => [one.from, one]))(
        "%s: names a graph the installation ships, of the agent it names",
        (_from, one) => {
            expect(graphs.get(one.target)?.agent).toBe(one.agent)
        },
    )

    it.each(handOffs.map((one) => [one.from, one]))(
        "%s: is open to a caller of another agent when it crosses agents",
        (_from, one) => {
            const target = graphs.get(one.target)?.graph
            const sameAgent = one.agent === one.from.split(".")[0]
            expect(sameAgent || target?.spec.entry.openTo === "any").toBe(true)
        },
    )

    it.each(handOffs.map((one) => [one.from, one]))(
        "%s: maps every required input of the target's contract",
        (_from, one) => {
            // A callee's contract reads the caller's params under `trigger.data` (R-triggers rule 13): the inputs a hand-off maps are the
            // members of its `data` input (`callInputsOf`), not the contract's top-level inputs (`data`, `caller`, ...).
            const required = callInputsOf(graphs.get(one.target)?.graph.spec.contract)
                .filter((input) => input.required)
                .map((input) => input.name)
            expect(required.filter((name) => !one.inputs.includes(name))).toEqual([])
        },
    )

    it.each(handOffs.map((one) => [one.from, one]))(
        "%s: maps no input the target's contract does not take",
        (_from, one) => {
            // The names a caller may map are the members of the callee's `data` input (`callInputsOf`), see the case above.
            const taken = callInputsOf(graphs.get(one.target)?.graph.spec.contract).map((input) => input.name)
            expect(one.inputs.filter((name) => !taken.includes(name))).toEqual([])
        },
    )
})
