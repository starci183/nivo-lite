import {
    ATTENTION_KINDS,
    parkedEntriesOf,
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
            "resume",
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
        expect(["awaiting_reply", "overdue", "needs_reply", "owner"].map(kindOfReason)).toEqual([
            "waiting",
            "overdue",
            "needs-reply",
            "owner",
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

    it("names a step and a failure the list has words for by their message keys, and keeps the raw words of others", () => {
        const [known, unknown] = parkedEntriesOf([
            { id: "a", step: "confirm", errorCode: "DELIVERY_FAILED", errorWords: "x" },
            { id: "b", step: "other", errorCode: "OTHER", errorWords: "y" },
        ])
        expect(known).toMatchObject({ titleKey: "failed_step_confirm", descriptionKey: "failed_reason_delivery" })
        expect(unknown).toEqual({ id: "b", kind: "failed", title: "other", description: "y", at: "" })
    })

    it("leaves out a record with no id and draws a record with missing words as empty ones", () => {
        const entries = attentionEntriesOf([{ title: "No id" }, { id: 5, reason: "owner" }])
        expect(entries).toEqual([{ id: "5", kind: "owner", title: "", description: "", at: "" }])
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

describe("parkedEntriesOf", () => {
    it("draws a parked run by its step, what the error says and when it was parked, under the id of the run", () => {
        expect(
            parkedEntriesOf([
                { id: "run-1", step: "invoice-x", errorWords: "no service", parkedAt: "2026-11-06T07:55:00.000Z" },
            ]),
        ).toEqual([
            {
                id: "run-1",
                kind: "failed",
                title: "invoice-x",
                description: "no service",
                at: "2026-11-06T07:55:00.000Z",
            },
        ])
    })

    it("leaves out a record with no id and draws missing words as empty ones", () => {
        expect(parkedEntriesOf([{ step: "x" }, { id: 4 }])).toEqual([
            { id: "4", kind: "failed", title: "", description: "", at: "" },
        ])
    })
})
