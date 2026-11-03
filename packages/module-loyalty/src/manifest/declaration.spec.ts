import { workbenchProblems } from "@nivo-lite/agent-sdk/workbench/contract"
import { LOYALTY_VIEW_IDS, LOYALTY_WORKBENCH } from "./declaration"

const Component = (): null => null

describe("LOYALTY_WORKBENCH", () => {
    it("is a sound workbench once paired with a component", () => {
        expect(workbenchProblems({ ...LOYALTY_WORKBENCH, render: { kind: "component", Component } })).toEqual([])
    })

    it("declares its views in the strip order of the route", () => {
        expect(LOYALTY_WORKBENCH.views.map((view) => view.id)).toEqual([...LOYALTY_VIEW_IDS])
        expect(LOYALTY_WORKBENCH.views.map((view) => view.labelKey)).toEqual(LOYALTY_VIEW_IDS.map((id) => `tab_${id}`))
    })
})
