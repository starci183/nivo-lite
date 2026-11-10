import { nameKey } from "./order.policy"
import { sampleOf } from "../../messages/catalog"

describe("order policy", () => {
    it("compares names without accents, case or extra spaces", () => {
        expect(nameKey(sampleOf("sampleDuongTraSen"))).toBe("duong tra sen")
        expect(nameKey(sampleOf("sampleD"))).toBe("d")
    })
})
