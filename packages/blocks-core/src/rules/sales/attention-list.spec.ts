import {
    ATTENTION_KINDS,
    ATTENTION_KIND_VIEWS,
    attentionEntriesOf,
    attentionListOf,
    kindOfReason,
} from "./attention-list"
import type { AttentionEntry } from "./attention-list"

const entry = (id: string, kind: AttentionEntry["kind"]): AttentionEntry => ({
    id,
    kind,
    title: id,
    description: "",
    at: "",
})

describe("the kinds of attention", () => {
    it("draw every kind with its own chip, command and tone", () => {
        expect(Object.keys(ATTENTION_KIND_VIEWS)).toEqual([...ATTENTION_KINDS])
        expect(ATTENTION_KINDS.map((kind) => ATTENTION_KIND_VIEWS[kind].command)).toEqual([
            "respond",
            "follow",
            "reply",
            "review",
            "retry",
        ])
        expect(ATTENTION_KINDS.map((kind) => ATTENTION_KIND_VIEWS[kind].tone)).toEqual([
            "warning",
            "danger",
            "info",
            "warning",
            "danger",
        ])
    })

    it("open the customer for the rows that are customers and not for an order or a step", () => {
        expect(ATTENTION_KINDS.filter((kind) => ATTENTION_KIND_VIEWS[kind].opensLead)).toEqual([
            "waiting",
            "overdue",
            "needs-reply",
        ])
    })
})

describe("kindOfReason", () => {
    it("names the kind each reason code is", () => {
        expect(["awaiting_reply", "overdue", "needs_reply", "owner", "failed_step"].map(kindOfReason)).toEqual([
            "waiting",
            "overdue",
            "needs-reply",
            "owner",
            "failed",
        ])
    })

    it("asks for a reply on a code it does not know, a name of the prototype among them", () => {
        expect(kindOfReason("other")).toBe("needs-reply")
        expect(kindOfReason("")).toBe("needs-reply")
        expect(kindOfReason("constructor")).toBe("needs-reply")
    })
})

describe("attentionEntriesOf", () => {
    it("takes the kind of a row from its reason and carries the time it waits since", () => {
        expect(
            attentionEntriesOf([
                { id: "l1", title: "Tan Phat", description: "Late", reason: "overdue", at: "2026-11-05T08:00:00.000Z" },
            ]),
        ).toEqual([
            { id: "l1", kind: "overdue", title: "Tan Phat", description: "Late", at: "2026-11-05T08:00:00.000Z" },
        ])
    })

    it("leaves out a record with no id and draws a record with missing words as empty ones", () => {
        const entries = attentionEntriesOf([{ title: "No id" }, { id: 5, reason: "failed_step" }])
        expect(entries).toEqual([{ id: "5", kind: "failed", title: "", description: "", at: "" }])
    })
})

describe("attentionListOf", () => {
    const all = [entry("f", "failed"), entry("a", "waiting"), entry("b", "overdue"), entry("c", "waiting")]

    it("lists the kinds in their order and keeps the order of a read inside a kind", () => {
        expect(attentionListOf(all, ATTENTION_KINDS).map((item) => item.id)).toEqual(["a", "c", "b", "f"])
    })

    it("leaves out the kinds the spec does not show", () => {
        expect(attentionListOf(all, ["failed", "overdue"]).map((item) => item.id)).toEqual(["b", "f"])
    })
})
