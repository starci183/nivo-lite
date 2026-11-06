import { chosenSort, sortChoicesOf, sortTriggerText } from "./sort-choice"

const WORDS = (text: object): string => ("key" in text ? `t:${String(text.key)}` : "")
const CHOICES = sortChoicesOf(
    [
        { value: "points", label: { key: "byPoints" } },
        { value: "recent", label: { key: "byRecent" } },
    ],
    WORDS,
)

describe("sortChoicesOf", () => {
    it("gives each option its words in the viewer's language", () => {
        expect(CHOICES).toEqual([
            { value: "points", label: "t:byPoints" },
            { value: "recent", label: "t:byRecent" },
        ])
    })
})

describe("chosenSort", () => {
    it("is the option the param names, else the first, else nothing", () => {
        expect(chosenSort(CHOICES, "recent")).toEqual({ value: "recent", label: "t:byRecent" })
        expect(chosenSort(CHOICES, null)).toEqual({ value: "points", label: "t:byPoints" })
        expect(chosenSort(CHOICES, "gone")).toEqual({ value: "points", label: "t:byPoints" })
        expect(chosenSort([], "recent")).toBeNull()
    })
})

describe("sortTriggerText", () => {
    it("reads the label, a colon and the chosen option", () => {
        expect(sortTriggerText("Sort", { value: "a", label: "Most points" })).toBe("Sort: Most points")
    })
})
