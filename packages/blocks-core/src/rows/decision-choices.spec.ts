import { choiceOf, pickedValues } from "./decision-choices"
import type { Choice } from "./decision-choices"

const PICK: Choice = {
    command: "assign-order",
    sends: "sales.resolve-unmatched-payment",
    pick: { valueName: "order", title: { key: "t" }, searchLabel: { key: "s" }, emptyBody: { key: "e" } },
}
const CONFIRM: Choice = {
    command: "other-income",
    sends: "sales.resolve-unmatched-payment",
    confirm: {
        title: { key: "t" },
        body: { key: "b" },
        confirmLabel: { key: "c" },
        cancelLabel: { key: "x" },
        values: { kind: "other-income" },
    },
}

describe("choiceOf", () => {
    it("finds the choice a row command is declared with", () => {
        expect(choiceOf([PICK, CONFIRM], "other-income")).toBe(CONFIRM)
    })

    it("answers null for a command that is not declared, or when no choice is declared", () => {
        expect(choiceOf([PICK], "approve")).toBeNull()
        expect(choiceOf(undefined, "approve")).toBeNull()
    })
})

describe("pickedValues", () => {
    it("sends the chosen id under the name the pick declares", () => {
        expect(pickedValues(PICK, "o-1")).toEqual({ order: "o-1" })
    })

    it("sends nothing for a choice that is a confirmation", () => {
        expect(pickedValues(CONFIRM, "o-1")).toBeNull()
    })
})
