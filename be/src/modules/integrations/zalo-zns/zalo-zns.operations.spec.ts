import { ZALO_ZNS_OPERATIONS } from "./zalo-zns.operations"

describe("the Zalo ZNS operations", () => {
    it("are all docs-missing: no method, no path, a documentation note that says what was searched", () => {
        const operations = Object.values(ZALO_ZNS_OPERATIONS)
        expect(operations).toHaveLength(4)
        for (const operation of operations) {
            expect(operation.api.startsWith("nivo.api.zalo-oa.zns.")).toBe(true)
            expect(operation.status).toBe("docs-missing")
            expect(operation.method).toBeNull()
            expect(operation.path).toBeNull()
            expect(operation.docs.startsWith("docs-missing:")).toBe(true)
        }
    })
})
