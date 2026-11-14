import { orderNumberOf, orderPrefixOf } from "./order-number"

describe("order numbers", () => {
    it("prefixes with the day in the workspace's time zone", () => {
        expect(orderPrefixOf(new Date("2026-10-13T10:00:00Z"), "Asia/Ho_Chi_Minh")).toBe("DH-20261013-")
        expect(orderPrefixOf(new Date("2026-10-13T18:00:00Z"), "Asia/Ho_Chi_Minh")).toBe("DH-20261014-")
    })

    it("a workspace in another zone gets another day at the same instant", () => {
        expect(orderPrefixOf(new Date("2026-10-13T18:00:00Z"), "Europe/Berlin")).toBe("DH-20261013-")
        expect(orderPrefixOf(new Date("2026-10-13T02:00:00Z"), "America/New_York")).toBe("DH-20261012-")
    })

    it("numbers the next order of the day, moving on after a clash", () => {
        expect(orderNumberOf(null, "DH-20261013-", 0, 0)).toBe("DH-20261013-0001")
        expect(orderNumberOf(null, "DH-20261013-", 11, 0)).toBe("DH-20261013-0012")
        expect(orderNumberOf(null, "DH-20261013-", 11, 2)).toBe("DH-20261013-0014")
    })

    it("keeps the number a channel gave, suffixing it after a clash", () => {
        expect(orderNumberOf("ZL-77", "DH-20261013-", 0, 0)).toBe("ZL-77")
        expect(orderNumberOf("ZL-77", "DH-20261013-", 0, 1)).toBe("ZL-77-11")
    })
})
