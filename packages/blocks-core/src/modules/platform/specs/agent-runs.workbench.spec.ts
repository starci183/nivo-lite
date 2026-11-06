import { AGENT_RUNS_SPEC } from "./agent-runs.workbench"

describe("AGENT_RUNS_SPEC", () => {
    it("keeps the status filter and the chosen run in the URL, each under its own key, and shows all runs first", () => {
        const params = AGENT_RUNS_SPEC.params ?? {}
        expect(Object.keys(params)).toEqual(["status", "run"])
        expect(Object.values(params).map((param) => param.url)).toEqual(["status", "run"])
        expect(params.status).toMatchObject({ type: "enum", default: "all" })
    })

    it("is one view: the list with its filter tabs beside the steps of the chosen run", () => {
        expect(AGENT_RUNS_SPEC.views.map((view) => view.id)).toEqual(["runs"])
        const blocks = JSON.stringify(AGENT_RUNS_SPEC.views[0]?.root)
        for (const block of [
            "core.master-detail",
            "core.list-pane",
            "core.filter-tabs",
            "core.record-list",
            "core.run-timeline",
        ])
            expect(blocks).toContain(block)
    })

    it("runs a run again through the platform action only", () => {
        const root = JSON.stringify(AGENT_RUNS_SPEC.views[0]?.root)
        expect(root).toContain('"action":"platform.resume-run"')
        expect(root.match(/"action":"/g)).toHaveLength(1)
    })
})
