import { poNumberOf, poNumberPrefix } from "./purchase-order.policy"

describe("poNumberPrefix", () => {
    it("names the month of the instant", () => {
        expect(poNumberPrefix(new Date("2026-10-12T08:00:00.000Z"))).toBe("PO-202610-")
        expect(poNumberPrefix(new Date("2027-01-02T00:00:00.000Z"))).toBe("PO-202701-")
    })
})

describe("poNumberOf", () => {
    it("starts a month at one", () => {
        expect(poNumberOf("PO-202610-", null)).toBe("PO-202610-0001")
    })

    it("follows the last number of the month", () => {
        expect(poNumberOf("PO-202610-", "PO-202610-0041")).toBe("PO-202610-0042")
    })

    it("starts again when the last number has no readable sequence", () => {
        expect(poNumberOf("PO-202610-", "PO-202610-xyz")).toBe("PO-202610-0001")
    })
})
