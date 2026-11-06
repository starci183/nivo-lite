import { MODULE_FIXTURES } from "./fixtures"
import { MODULE_FIXTURES as DECLARED } from "./modules/module-fixtures"

describe("the fixtures entry of the package", () => {
    it("hands out the fixtures of the modules, the same ones the modules declare", () => {
        expect(MODULE_FIXTURES).toBe(DECLARED)
        expect(Object.keys(MODULE_FIXTURES).length).toBeGreaterThan(0)
    })
})
