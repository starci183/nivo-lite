import { coreRun } from "./fixtures/agent-runs.ports"
import { doneRowOf } from "./runs-done"

describe("doneRowOf", () => {
    it("heads the row with the trigger and details it with the instant the run ended", () => {
        expect(doneRowOf(coreRun("r1", { trigger: "tag", endedAt: "2026-11-04T11:00:00.000Z" }))).toEqual({
            id: "r1",
            title: "tag",
            description: "2026-11-04T11:00:00.000Z",
            href: "",
        })
    })

    it("leaves a field the engine did not give empty", () => {
        expect(doneRowOf(coreRun("r1", { trigger: "", endedAt: null }))).toEqual({ id: "r1", title: "", description: "", href: "" })
    })
})
