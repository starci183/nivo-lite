import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import { contentAgent } from "./content.agent"
import { contentDraftGraph } from "./draft.graph"
import { contentPlanGraph } from "./plan.graph"
import { contentReportGraph } from "./report.graph"

/**
 * The Content graphs and agent. Importing them is the first check: the builders throw at module load with every problem decidable
 * without the engine (refs, routes, reachability, accounts against the agent's providers, a verb shared by two graphs).
 */
describe("content.plan", () => {
    it("is woken by the morning clock and a workflow's call, never by an unfiltered team chat line", () => {
        expect(contentPlanGraph.spec.triggers).toEqual([
            { verb: TRIGGER.clockTick, args: { preset: "daily_at", at: "07:00" } },
            { verb: TRIGGER.workflowCalled },
        ])
    })

    it("hands the clock's run to the report, plans, then writes and approves each new post", () => {
        expect(contentPlanGraph.spec.nodes.map((step) => step.key)).toEqual([
            "is-clock",
            "to-report",
            "plan",
            "plan-declined",
            "plan-declined-notice",
            "posts",
            "draft",
            "draft-declined",
            "draft-declined-notice",
            "review",
            "approved",
            "notice",
            "planned",
            "declined",
        ])
        expect(contentPlanGraph.spec.nodes.find((step) => step.key === "to-report")).toMatchObject({
            params: { agent: "content", workflow: "report" },
        })
    })

    it("a declined plan write is told to the team and ends declined; a declined draft write ends only its item", () => {
        const steps = contentPlanGraph.spec.nodes
        const stepOf = (key: string) => steps.find((step) => step.key === key)
        expect(stepOf("plan")).toMatchObject({ next: "plan-declined" })
        expect(stepOf("plan-declined")).toMatchObject({
            kind: "if",
            params: { when: { op: "eq", ref: { $ref: "steps.plan.output.declined" }, value: true } },
            routes: { yes: "plan-declined-notice", no: "posts" },
        })
        expect(stepOf("plan-declined-notice")).toMatchObject({ step: "team.declined-notice", next: "declined" })
        expect(stepOf("draft-declined-notice")).toMatchObject({
            step: "team.declined-notice",
            params: { scope: "item" },
        })
        expect(contentPlanGraph.spec.outcomes.map((outcome) => outcome.key).toSorted()).toEqual(["declined", "planned"])
    })
})

describe("content.draft", () => {
    it("is called with one post, writes it, asks a person, tells the team and hands an approved TikTok post to the video agent", () => {
        expect(contentDraftGraph.spec.triggers).toEqual([{ verb: TRIGGER.workflowCalled }])
        expect(contentDraftGraph.spec.nodes.map((step) => step.key)).toEqual([
            "draft",
            "draft-declined",
            "draft-declined-notice",
            "review",
            "approved",
            "notice",
            "is-video",
            "to-video",
            "approved-post",
            "declined",
        ])
        expect(contentDraftGraph.spec.nodes.find((step) => step.key === "to-video")).toMatchObject({
            params: { agent: "video", workflow: "produce", inputs: { text: { $ref: "steps.draft.output.text" } } },
        })
    })

    it("a declined write of the words is told to the team and ends declined", () => {
        const steps = contentDraftGraph.spec.nodes
        const stepOf = (key: string) => steps.find((step) => step.key === key)
        expect(stepOf("draft")).toMatchObject({ next: "draft-declined" })
        expect(stepOf("draft-declined")).toMatchObject({
            kind: "if",
            params: { when: { op: "eq", ref: { $ref: "steps.draft.output.declined" }, value: true } },
            routes: { yes: "draft-declined-notice", no: "review" },
        })
        expect(stepOf("draft-declined-notice")).toMatchObject({ step: "team.declined-notice", next: "declined" })
        expect(stepOf("declined")).toMatchObject({ kind: "outcome", params: { outcome: "declined" } })
    })
})

describe("content.report", () => {
    it("is called by the plan's morning run and reports in one step", () => {
        expect(contentReportGraph.spec.triggers).toEqual([{ verb: TRIGGER.workflowCalled }])
        expect(contentReportGraph.spec.nodes.map((step) => step.key)).toEqual(["report", "reported"])
    })
})

describe("the Content agent", () => {
    it("opens on the plan and lists the plan, the drafting and the report, on no account", () => {
        expect(contentAgent.primary).toBe("content.plan")
        expect(contentAgent.graphs.map((graph) => graph.key)).toEqual(["content.plan", "content.draft", "content.report"])
        expect(contentAgent.accounts).toEqual([])
    })
})
