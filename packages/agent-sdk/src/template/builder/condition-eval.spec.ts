import type { StoredExpr, StoredRef } from "../../graph/graph-spec-v2.types"
import type { JsonValue } from "../../schema/schema.types"
import { TOOL } from "../../names"
import { compareHolds, exprHolds, exprTruth, isIsoInstantText, presenceHolds } from "./condition-eval"
import { node, ref } from "./graph-builder"
import { remindCheck, remindRecord } from "./template.fixture"

const scope: Readonly<Record<string, JsonValue>> = {
    dryRun: false,
    invoiceNo: "HD-1",
    empty: [],
    amount: 5,
    at: "2026-01-02",
}
const read = (stored: StoredRef): JsonValue => scope[stored.$ref] ?? stored.default ?? null
const at = (name: string): StoredRef => ({ $ref: name, default: null })

describe("exprHolds (the one evaluator of conditions, ifNode.when included)", () => {
    it.each<readonly [string, StoredExpr, boolean]>([
        ["eq on a boolean", { ref: at("dryRun"), op: "eq", value: false }, true],
        ["eq never mixes kinds", { ref: at("amount"), op: "eq", value: "5" }, false],
        ["ne", { ref: at("invoiceNo"), op: "ne", value: "HD-2" }, true],
        ["gt on numbers", { ref: at("amount"), op: "gt", value: 4 }, true],
        ["lte on numbers", { ref: at("amount"), op: "lte", value: 4 }, false],
        ["lt on ISO dates", { ref: at("at"), op: "lt", value: "2026-01-03" }, true],
        ["order never compares text with a number", { ref: at("at"), op: "gt", value: 1 }, false],
        ["order never compares free text", { ref: at("invoiceNo"), op: "gt", value: "HD-0" }, false],
        ["a ref on the right", { ref: at("amount"), op: "gte", value: at("amount") }, true],
        ["present", { ref: at("invoiceNo"), op: "present" }, true],
        ["an empty list is absent", { ref: at("empty"), op: "absent" }, true],
        ["a missing value reads its default, null", { ref: at("nothing"), op: "absent" }, true],
        [
            "and",
            {
                and: [
                    { ref: at("dryRun"), op: "eq", value: false },
                    { ref: at("invoiceNo"), op: "present" },
                ],
            },
            true,
        ],
        [
            "and fails on one",
            {
                and: [
                    { ref: at("dryRun"), op: "eq", value: true },
                    { ref: at("invoiceNo"), op: "present" },
                ],
            },
            false,
        ],
        [
            "or",
            {
                or: [
                    { ref: at("dryRun"), op: "eq", value: true },
                    { ref: at("invoiceNo"), op: "present" },
                ],
            },
            true,
        ],
    ])("%s", (_label, condition, holds) => {
        expect(exprHolds(condition, read)).toBe(holds)
    })

    it("exposes the leaf tests", () => {
        expect(compareHolds("eq", { a: [1] }, { a: [1] })).toBe(true)
        expect(presenceHolds("present", "")).toBe(false)
    })
})

describe("names and bindings are typed", () => {
    it("refuses at compile time what the save would refuse", () => {
        // @ts-expect-error a tool id that is not declared is no tool
        const unknownTool: typeof TOOL.customerMessageSend = "nivo.tool.lead.message.shout"
        // @ts-expect-error a typed ref of the wrong type does not bind a string member
        const wrongRef = node(remindRecord, { input: { orderId: ref<number>("trigger.amount") } })
        // @ts-expect-error every route of a routing node needs its target
        const partial = node(remindCheck, { routes: { due: "a" } })
        // @ts-expect-error a route name the node does not declare
        const extra = node(remindCheck, { routes: { due: "a", later: "b", never: "c" } })
        expect([unknownTool, wrongRef.kind, partial.kind, extra.kind]).toHaveLength(4)
    })
})

describe("three-valued truth and the ISO instant shape (proofs of the lint splits)", () => {
    const unknown: StoredExpr = { ref: at("invoiceNo"), op: "gt", value: "HD-0" }
    const yes: StoredExpr = { ref: at("invoiceNo"), op: "present" }
    const no: StoredExpr = { ref: at("invoiceNo"), op: "absent" }

    it.each<[string, StoredExpr, boolean | "unknown"]>([
        ["and: false beats unknown", { and: [unknown, no, yes] }, false],
        ["and: unknown beats true", { and: [yes, unknown] }, "unknown"],
        ["and: all true", { and: [yes, yes] }, true],
        ["or: true beats unknown", { or: [unknown, yes, no] }, true],
        ["or: unknown beats false", { or: [no, unknown] }, "unknown"],
        ["or: all false", { or: [no, no] }, false],
        // No empty `and` / `or` row: a stored `and` / `or` holds at least one part (`StoredAnd` / `StoredOr`, schema `z.tuple([self], self)`).
    ])("%s", (_label, expr, truth) => {
        expect(exprTruth(expr, read)).toBe(truth)
    })

    it.each<[string, boolean]>([
        ["2026-01-03", true],
        ["2026-01-03T10:00Z", true],
        ["2026-01-03T10:00:30Z", true],
        ["2026-01-03T10:00:30.123456789+07:00", true],
        ["2026-01-03T10:00:30-05:30", true],
        ["2026-01-03T10:00", false],
        ["2026-01-03T10:00:30.1234567890Z", false],
        ["2026-01-03 10:00Z", false],
        ["2026-01-03T", false],
        ["2026-1-03", false],
        ["2026-01-033", false],
        ["2026-13-45", false],
        ["2026-01-03T10:00:30+0700", false],
    ])("isIsoInstantText(%s) is %s", (text, holds) => {
        expect(isIsoInstantText(text)).toBe(holds)
    })
})
