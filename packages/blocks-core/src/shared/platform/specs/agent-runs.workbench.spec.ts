import { AGENT_RUNS_SPEC } from "./agent-runs.workbench"

describe("AGENT_RUNS_SPEC", () => {
    it("keeps the status filter and the chosen run in the URL, each under its own key, and shows all runs first", () => {
        const params = AGENT_RUNS_SPEC.params ?? {}
        expect(Object.keys(params)).toEqual(["status", "run"])
        expect(Object.values(params).map((param) => param.url)).toEqual(["status", "run"])
        expect(params.status).toMatchObject({ type: "enum", default: "all" })
    })

    it("is one view: the list card, with its filter tabs in its header, beside the steps of the chosen run", () => {
        expect(AGENT_RUNS_SPEC.views.map((view) => view.id)).toEqual(["runs"])
        const blocks = JSON.stringify(AGENT_RUNS_SPEC.views[0]?.root)
        for (const block of ["core.master-detail", "core.list-card", "core.run-timeline"])
            expect(blocks).toContain(block)
    })

    it("gives a cancelled run its own tab, label and neutral tone, beside the four others", () => {
        const pane = JSON.stringify(AGENT_RUNS_SPEC.views[0]?.root)
        expect(AGENT_RUNS_SPEC.params?.status).toMatchObject({
            of: ["all", "running", "parked", "done", "failed", "cancelled"],
        })
        expect(pane).toContain('"badgeTones":{"running":"info","parked":"warning","done":"success","failed":"danger","cancelled":"neutral"}')
        expect(pane).toContain('"value":"cancelled","label":{"key":"status_cancelled"}')
        expect(pane).toContain('"cancelled":{"key":"status_cancelled"}')
    })

    it("runs a run again through the platform action only", () => {
        const root = JSON.stringify(AGENT_RUNS_SPEC.views[0]?.root)
        expect(root).toContain('"action":"platform.resume-run"')
        expect(root.match(/"action":"/g)).toHaveLength(1)
    })
})
