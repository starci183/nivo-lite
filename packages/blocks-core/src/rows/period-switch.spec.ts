import { periodSwitchOf } from "./period-switch"

const WORDS = { label: "Period", thisMonth: "This month", lastMonth: "Last month" }

describe("periodSwitchOf", () => {
    it("offers this month and last month and marks the one shown", () => {
        const fields = periodSwitchOf(WORDS, "last", () => undefined)
        expect(fields.items.map((item) => [item.id, item.label])).toEqual([
            ["this", "This month"],
            ["last", "Last month"],
        ])
        expect(fields.selectedKey).toBe("last")
        expect(fields.label).toBe("Period")
    })

    it("tells the period the person chose, this month for anything but last", () => {
        const chosen: Array<string> = []
        const fields = periodSwitchOf(WORDS, "this", (period) => chosen.push(period))
        fields.onSelect("last")
        fields.onSelect("this")
        fields.onSelect("other")
        expect(chosen).toEqual(["last", "this", "this"])
    })
})
