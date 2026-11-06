import { SALES_SETTINGS_DEFAULTS } from "../../rules/sales/settings"
import { LEAD_NEW, ORDER_WAITING } from "./fixtures/sales.data"
import { leadDetailOf, orderDetailOf } from "./details"

describe("leadDetailOf", () => {
    it("shows an unknown company and need as empty text", () => {
        const detail = leadDetailOf(
            { ...LEAD_NEW, company: null, need: null },
            { count: 0, confirmedVnd: 0, latest: null },
        )
        expect(detail).toMatchObject({ company: "", need: "", orderCount: 0, latestOrderNo: null })
    })

    it("carries the company and the need the lead has", () => {
        expect(
            leadDetailOf({ ...LEAD_NEW, company: "Lotus", need: "Pots" }, { count: 0, confirmedVnd: 0, latest: null }),
        ).toMatchObject({ company: "Lotus", need: "Pots" })
    })
})

describe("orderDetailOf", () => {
    it("names who confirms a draft that waits for the owner", () => {
        expect(orderDetailOf(ORDER_WAITING, "Lan", SALES_SETTINGS_DEFAULTS)).toMatchObject({
            approval: "owner",
            customer: "Lan",
        })
    })
})
