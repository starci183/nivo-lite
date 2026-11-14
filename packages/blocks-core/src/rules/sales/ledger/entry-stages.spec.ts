import { adjustTargetOf, entryRecord, entryTitleOf, stagesOf, stateKeyOf } from "./entry-stages"
import type { StageWords } from "./entry-stages"
import type { LineageStep } from "./lineage"

const WORDS: StageWords = {
    names: {
        order: "\u0110\u01a1n h\u00e0ng",
        invoice: "H\u00f3a \u0111\u01a1n",
        payment: "Kho\u1ea3n thu",
        adjustment: "\u0110i\u1ec1u ch\u1ec9nh",
    },
    missing: "Ch\u01b0a c\u00f3",
    state: (kind, status) => (status === "known" ? `${kind} known` : undefined),
}

const step = (changes: Partial<LineageStep>): LineageStep => ({
    id: "s1",
    kind: "order",
    title: "#1087",
    detail: null,
    at: null,
    status: null,
    amount: null,
    ...changes,
})

describe("stagesOf", () => {
    it("draws the stages of an entry that has an order and an invoice, and the payment as waiting", () => {
        const stages = stagesOf(
            [
                step({ id: "o", kind: "order", status: "known", at: "2026-10-28T03:00:00.000Z" }),
                step({
                    id: "i",
                    kind: "invoice",
                    title: "H\u0110-0140",
                    detail: "K\u1ebf to\u00e1n t\u1ef1 xu\u1ea5t",
                    at: "2026-10-29T03:00:00.000Z",
                    status: "odd",
                }),
            ],
            WORDS,
        )
        expect(stages).toEqual([
            { id: "o", isDone: true, title: "\u0110\u01a1n h\u00e0ng #1087", note: "order known \u00b7 28/10" },
            {
                id: "i",
                isDone: true,
                title: "H\u00f3a \u0111\u01a1n H\u0110-0140",
                note: "29/10 \u00b7 K\u1ebf to\u00e1n t\u1ef1 xu\u1ea5t",
            },
            { id: "payment", isDone: false, title: "Kho\u1ea3n thu", note: "Ch\u01b0a c\u00f3" },
        ])
    })

    it("names a payment by its stage and adds the corrections after the stages", () => {
        const stages = stagesOf(
            [
                step({ id: "p", kind: "payment", title: "Anh Khoa" }),
                step({ id: "a", kind: "adjustment", title: "owner", detail: "s\u1eeda s\u1ed1 ti\u1ec1n" }),
            ],
            WORDS,
        )
        expect(stages.map((stage) => stage.title)).toEqual([
            "\u0110\u01a1n h\u00e0ng",
            "H\u00f3a \u0111\u01a1n",
            "Kho\u1ea3n thu",
            "\u0110i\u1ec1u ch\u1ec9nh",
        ])
        expect(stages.map((stage) => stage.isDone)).toEqual([false, false, true, true])
        expect(stages[3]?.note).toBe("s\u1eeda s\u1ed1 ti\u1ec1n")
    })
})

describe("stateKeyOf", () => {
    it("keys the states the stages have words for and no other", () => {
        expect(stateKeyOf("invoice", "issued")).toBe("state_invoice_issued")
        expect(stateKeyOf("invoice", "confirmed")).toBeUndefined()
        expect(stateKeyOf("adjustment", "x")).toBeUndefined()
    })
})

describe("adjustTargetOf", () => {
    it("points a correction at the invoice or the payment, and at nothing for a correction", () => {
        expect(adjustTargetOf({ sourceEntity: "blocks-core.sales.invoice", sourceId: "i" })).toEqual({
            targetType: "invoice",
            targetId: "i",
        })
        expect(adjustTargetOf({ sourceEntity: "blocks-core.sales.transaction", sourceId: "t" })).toEqual({
            targetType: "transaction",
            targetId: "t",
        })
        expect(adjustTargetOf({ sourceEntity: "blocks-core.sales.ledger-adjustment", sourceId: "a" })).toBeNull()
    })
})

describe("entryRecord", () => {
    const base = { id: "e", sourceEntity: "x", sourceId: "y", lineage: [step({})] }

    it("takes an entry with its lineage and refuses a step of an unknown kind", () => {
        expect(entryRecord.safeParse(base).success).toBe(true)
        expect(entryRecord.safeParse({ ...base, lineage: [{ ...step({}), kind: "x" }] }).success).toBe(false)
    })

    it("reads the flag that offers the ledger re-post, and refuses one that is not a boolean", () => {
        expect(entryRecord.safeParse({ ...base, canRepostLedger: true }).success).toBe(true)
        expect(entryRecord.safeParse({ ...base, canRepostLedger: "yes" }).success).toBe(false)
    })

    it("titles the entry by its note, or by its id when it has none", () => {
        expect(entryTitleOf({ ...base, note: "H\u0110-0140" })).toBe("H\u0110-0140")
        expect(entryTitleOf({ ...base, note: null })).toBe("e")
        expect(entryTitleOf({ ...base, note: "" })).toBe("e")
        expect(entryTitleOf(base)).toBe("e")
    })
})
