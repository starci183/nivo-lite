import type { RowActionDeclared, RowActionSource } from "./row-actions"
import { OPEN_KEY, lookOf, offerFor, offersOf } from "./row-actions"

const WORDS = (text: object): string => ("key" in text ? `t:${String(text.key)}` : "")
const SOURCES: Readonly<Record<string, RowActionSource>> = {
    action1: { isAllowed: true, label: "Reply" },
    action2: { isAllowed: true, label: "Follow" },
    action3: { isAllowed: false, label: "Retry" },
}
const source = (slot: string): RowActionSource => SOURCES[slot] ?? { isAllowed: false, label: "" }
const CLOSED: RowActionSource = { isAllowed: false, label: "Open" }
const OPEN: RowActionSource = { isAllowed: true, label: "Open" }

describe("lookOf", () => {
    it("is neutral without an intent, destructive for danger and the intent itself otherwise", () => {
        expect(lookOf(undefined)).toBe("neutral")
        expect(lookOf("danger")).toBe("destructive")
        expect(lookOf("commit")).toBe("commit")
        expect(lookOf("dismiss")).toBe("dismiss")
    })
})

describe("offersOf", () => {
    const declared: ReadonlyArray<RowActionDeclared> = [
        { slot: "action1", key: "reply", label: { key: "replyLabel" }, intent: "commit" },
        { slot: "action2" },
        { slot: "action3", key: "retry" },
    ]

    it("offers the declared commands the viewer may run, with the words of the spec or else of the action", () => {
        expect(offersOf(declared, source, CLOSED, WORDS)).toEqual([
            { key: "reply", slot: "action1", label: "t:replyLabel", look: "commit" },
            { key: "action2", slot: "action2", label: "Follow", look: "neutral" },
        ])
    })

    it("ends with the single open action when the viewer may run it", () => {
        expect(offersOf([], source, OPEN, WORDS)).toEqual([
            { key: OPEN_KEY, slot: OPEN_KEY, label: "Open", look: "neutral" },
        ])
        expect(offersOf([], source, CLOSED, WORDS)).toEqual([])
    })
})

describe("offerFor", () => {
    const offers = offersOf(
        [
            { slot: "action1", key: "reply" },
            { slot: "action2", key: "follow" },
        ],
        source,
        OPEN,
        WORDS,
    )

    it("draws the first command on every row when the list has no choice field", () => {
        expect(offerFor(offers, undefined)?.key).toBe("reply")
        expect(offerFor([], undefined)).toBeNull()
    })

    it("draws the command a row's value names, the open action included, and none for a value that names none", () => {
        expect(offerFor(offers, "follow")?.slot).toBe("action2")
        expect(offerFor(offers, OPEN_KEY)?.slot).toBe(OPEN_KEY)
        expect(offerFor(offers, "")).toBeNull()
        expect(offerFor(offers, "gone")).toBeNull()
    })
})
