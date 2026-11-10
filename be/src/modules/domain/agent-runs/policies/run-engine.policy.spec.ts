import { isOldEngineRun } from "./run-engine.policy"

describe("isOldEngineRun", () => {
    it("lets the old engine move only its own runs: legacy, or a record that names no engine", () => {
        expect(isOldEngineRun({ engine: "legacy" })).toBe(true)
        expect(isOldEngineRun({})).toBe(true)
        expect(isOldEngineRun({ engine: "langgraph" })).toBe(false)
    })
})
