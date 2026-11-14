import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateGraph,
    type TemplateTriggerLookup,
    templateAgentProblems,
    templateGraphProblems,
} from "@nivo-lite/agent-sdk/template"
import { hiringAgent } from "./hiring.agent"
import { hiringDigestGraph } from "./digest.graph"
import { hiringScreenGraph } from "./screen.graph"

/** The engine's trigger lookup as this spec assumes it: the clock supplies its slot, a call what it maps. */
const triggers: TemplateTriggerLookup = {
    supplies: (verb) => {
        if (verb === TRIGGER.workflowCalled) return { kind: "caller" }
        if (verb === TRIGGER.clockTick) return { kind: "fixed", params: [{ name: "slotMs", type: "integer" }] }
        return { kind: "unknown" }
    },
}

/** A graph's steps by key, each with its kind and, for a node step, its node id. */
const stepsOf = (graph: TemplateGraph): ReadonlyArray<readonly [string, string]> =>
    graph.spec.nodes.map((step) => [step.key, step.kind === "node" ? step.step : step.kind] as const)

describe("the Hiring agent template", () => {
    it("loads with no problem, its graphs judged with its providers and the triggers' supplies", () => {
        expect(templateAgentProblems(hiringAgent, { triggers })).toEqual([])
        for (const graph of hiringAgent.graphs) {
            expect(
                templateGraphProblems(graph.spec, {
                    nodes: graph.nodes,
                    agentAccounts: hiringAgent.accounts,
                    triggers,
                }),
            ).toEqual([])
        }
    })

    it("screens, tells the team, drafts the invitation for a person to approve, then moves the mailed candidate (one write per step)", () => {
        expect(hiringScreenGraph.spec.catalogue?.version).toBe(4)
        expect(hiringScreenGraph.spec.nodes.find((step) => step.key === "invite")).toMatchObject({ mode: "ask" })
        expect(hiringScreenGraph.spec.nodes.find((step) => step.key === "move")).toMatchObject({ mode: "auto" })
        expect(hiringAgent.primary).toBe("hiring.screen")
        expect(stepsOf(hiringScreenGraph)).toEqual([
            ["screen", "hiring.screen"],
            ["screen-declined", "if"],
            ["screen-declined-notice", "team.declined-notice"],
            ["notify", "hiring.notify"],
            ["invite", "hiring.invite"],
            ["invite-declined", "if"],
            ["invite-declined-notice", "team.declined-notice"],
            ["mailed", "if"],
            ["move", "hiring.invite-move"],
            ["move-declined", "if"],
            ["move-declined-notice", "team.declined-notice"],
            ["screened", "outcome"],
            ["declined", "outcome"],
        ])
    })

    it("routes a declined screening write, a declined invitation and a declined move after the mail to a team notice and the outcome declined", () => {
        const steps = hiringScreenGraph.spec.nodes
        const stepOf = (key: string) => steps.find((step) => step.key === key)
        expect(stepOf("screen")).toMatchObject({ next: "screen-declined" })
        expect(stepOf("screen-declined")).toMatchObject({
            kind: "if",
            params: { when: { op: "eq", ref: { $ref: "steps.screen.output.declined" }, value: true } },
            routes: { yes: "screen-declined-notice", no: "notify" },
        })
        expect(stepOf("invite")).toMatchObject({ next: "invite-declined" })
        expect(stepOf("invite-declined")).toMatchObject({
            kind: "if",
            params: { when: { op: "eq", ref: { $ref: "steps.invite.output.declined" }, value: true } },
            routes: { yes: "invite-declined-notice", no: "mailed" },
        })
        expect(stepOf("mailed")).toMatchObject({
            kind: "if",
            params: { when: { op: "eq", ref: { $ref: "steps.invite.output.mailed" }, value: true } },
            routes: { yes: "move", no: "screened" },
        })
        expect(stepOf("move")).toMatchObject({ step: "hiring.invite-move", next: "move-declined" })
        expect(stepOf("move-declined")).toMatchObject({
            kind: "if",
            params: { when: { op: "eq", ref: { $ref: "steps.move.output.declined" }, value: true } },
            routes: { yes: "move-declined-notice", no: "screened" },
        })
        for (const key of ["screen-declined-notice", "invite-declined-notice", "move-declined-notice"])
            expect(stepOf(key)).toMatchObject({ step: "team.declined-notice", next: "declined" })
        expect(stepOf("declined")).toMatchObject({ kind: "outcome", params: { outcome: "declined" } })
    })

    it("writes the morning digest and posts it only when something is open", () => {
        expect(stepsOf(hiringDigestGraph).map(([key]) => key)).toEqual([
            "digest",
            "has-open",
            "notify",
            "posted",
            "quiet",
        ])
    })
})
