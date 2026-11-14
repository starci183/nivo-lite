import type { StoredExpr, StoredRef } from "@nivo-lite/agent-sdk/graph"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { exprHolds } from "@nivo-lite/agent-sdk/template"
import { webbooksInvoiceIssueNode } from "../../../nodes/webbooks/invoice-issue.node"
import { webbooksIssueRecordNode } from "../../../nodes/webbooks/issue-record.node"
import { invoiceGraph } from "./invoice.graph"

// R57 (owner ruling): `webbooks.invoice` v10 issues on the MISA meInvoice account and records the issued invoice in the CRM; it ends
// `invoiced` only once recorded. These cases evaluate the STORED conditions against the nodes' OWN example outputs.
// R68 (v11): the `draft-declined`/`issue-declined` ifs and their notices are gone; a declined draft or issue is the step's stored
// `unsuccessful` ending (the engine tells the team, the run ends at `declined`), so the cases read the stored option instead.

const steps = invoiceGraph.spec.nodes

const stepOf = (key: string) => {
    const found = steps.find((one) => one.key === key)
    if (found === undefined) throw new Error(`no step ${key}`)
    return found
}

const conditionOf = (key: string): StoredExpr => {
    const step = stepOf(key) as { readonly params: Readonly<Record<string, StoredExpr>> }
    const found = step.params["when"]
    if (found === undefined) throw new Error(`no when on ${key}`)
    return found
}

const readerOf =
    (scope: Readonly<Record<string, JsonValue>>) =>
    (ref: StoredRef): JsonValue => {
        let at: JsonValue | undefined = scope as JsonValue
        for (const part of ref.$ref.split(".")) {
            at = at !== null && typeof at === "object" && !Array.isArray(at) ? (at as Record<string, JsonValue>)[part] : undefined
        }
        return at === undefined ? (ref.default ?? null) : at
    }

const exampleOutput = (
    examples: ReadonlyArray<{ readonly output?: unknown }>,
    has: (output: Record<string, JsonValue>) => boolean,
): Record<string, JsonValue> => {
    const found = examples
        .map((example) => example.output as Record<string, JsonValue> | undefined)
        .find((output) => output !== undefined && has(output))
    if (found === undefined) throw new Error("no such example output")
    return found
}

const issue = (has: (output: Record<string, JsonValue>) => boolean) => exampleOutput(webbooksInvoiceIssueNode.examples, has)
const ISSUED = issue((output) => output["outcome"] === "issued" && output["invoiceNo"] !== null)
const NUMBERLESS = issue((output) => output["outcome"] === "issued" && output["invoiceNo"] === null)
const REJECTED = issue((output) => output["outcome"] === "rejected")
const DECLINED = issue((output) => output["declined"] === true)
const RECORDED = exampleOutput(webbooksIssueRecordNode.examples, (output) => output["recorded"] === true)
const NOT_RECORDED = exampleOutput(webbooksIssueRecordNode.examples, (output) => output["recorded"] === false)

const holds = (key: string, scope: Readonly<Record<string, JsonValue>>): boolean => exprHolds(conditionOf(key), readerOf(scope))
const scopeOf = (issued: Record<string, JsonValue>, record: Record<string, JsonValue> | null = null) => ({
    steps: { issue: { output: issued }, ...(record === null ? {} : { record: { output: record } }) },
})

describe("webbooks.invoice v11: issued on MISA, recorded in the CRM (R57)", () => {
    it("routes an issued invoice with a number to the record, then the mail and the team; else straight to the team", () => {
        expect(stepOf("issued")).toMatchObject({ routes: { yes: "record", no: "team" } })
        expect(stepOf("record")).toMatchObject({ next: "mail" })
        expect(stepOf("mail")).toMatchObject({ next: "team" })
        expect(stepOf("team-declined")).toMatchObject({ routes: { yes: "declined", no: "recorded" } })
        expect(stepOf("recorded")).toMatchObject({ routes: { yes: "invoiced", no: "not-invoiced" } })
        expect(invoiceGraph.spec.outcomes.map((end) => end.key).toSorted()).toEqual(["declined", "invoiced", "not-invoiced"])
    })

    it("an issued invoice with a number is recorded, and ends `invoiced` once the CRM recorded it", () => {
        expect(ISSUED["declined"]).toBe(false)
        expect(holds("issued", scopeOf(ISSUED))).toBe(true)
        expect(holds("recorded", scopeOf(ISSUED, RECORDED))).toBe(true)
        expect(holds("recorded", scopeOf(ISSUED, NOT_RECORDED))).toBe(false)
    })

    it("issued without a number yet: no record, no mail; the team is told and the run ends `not-invoiced`", () => {
        expect(holds("issued", scopeOf(NUMBERLESS))).toBe(false)
        expect(holds("recorded", scopeOf(NUMBERLESS))).toBe(false)
    })

    it("rejected: nothing issued; the team is told and the run ends `not-invoiced`", () => {
        expect(REJECTED["declined"]).toBe(false)
        expect(holds("issued", scopeOf(REJECTED))).toBe(false)
        expect(holds("recorded", scopeOf(REJECTED))).toBe(false)
    })

    it("a declined draft or issue is the step's unsuccessful ending: the engine tells the team the service, the run ends `declined`", () => {
        expect(DECLINED["declined"]).toBe(true)
        const ending = {
            then: "end",
            outcome: "declined",
            facts: [{ label: { vi: "Mã dịch vụ", en: "Service" }, value: { $ref: "trigger.data.serviceCode" } }],
        }
        expect(stepOf("issue")).toMatchObject({ next: "issued", unsuccessful: ending })
        expect(stepOf("draft")).toMatchObject({ next: "issue", unsuccessful: ending })
        expect(steps.some((one) => one.key.endsWith("-notice") || one.key.endsWith("-declined") && one.key !== "team-declined")).toBe(false)
    })
})
