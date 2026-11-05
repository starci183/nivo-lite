import { LOYALTY_WORKBENCH } from "./manifest"
import { LOYALTY_MODULE_KEY } from "./module-key"
import { LOYALTY_SERVER } from "./template"

describe("the Loyalty module key", () => {
    it("is the key of its template and of its workbench", () => {
        expect(LOYALTY_SERVER.key).toBe(LOYALTY_MODULE_KEY)
        expect(LOYALTY_WORKBENCH.key).toBe(LOYALTY_MODULE_KEY)
    })
})
