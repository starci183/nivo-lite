import type { StoredExpr, StoredRef } from "@nivo-lite/agent-sdk/graph"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { exprHolds } from "@nivo-lite/agent-sdk/template"
import { webdeskUnderstandSalesNode } from "../../../nodes/webdesk/understand-sales.node"
import { websalesAskNode } from "../../../nodes/websales/ask.node"
import { websalesPurchaseOpenNode } from "../../../nodes/websales/purchase-open.node"
import { websalesUnderstandNode } from "../../../nodes/websales/understand.node"
import { enquiryGraph } from "./enquiry.graph"

// R53 (owner 2026-11-14: "a conversation is ONE run"; business kept, form converted): `websales.enquiry` v8 is v7's steps inside a talk
// loop. These cases evaluate the STORED conditions of the graph (the `until` of the talk, the routing after it) against the nodes' OWN
// example outputs, as the engine records them (R46: a loop's `last` = the output of the last NODE step of the final round), so the
// conversion is proven on real shapes, not on hand-made ones. Importing the graph builds it: reaching here means every save check holds.

const steps = enquiryGraph.spec.nodes

/** The stored condition of an if-step, or the `until` of a loop. */
const conditionOf = (key: string, member: "when" | "until"): StoredExpr => {
    const step = steps.find((one) => one.key === key) as { readonly params: Readonly<Record<string, StoredExpr>> } | undefined
    const found = step?.params[member]
    if (found === undefined) throw new Error(`no ${member} on ${key}`)
    return found
}

/** A reader of refs over a run scope: a dotted path into `scope`, else the ref's default. */
const readerOf =
    (scope: Readonly<Record<string, JsonValue>>) =>
    (ref: StoredRef): JsonValue => {
        let at: JsonValue | undefined = scope as JsonValue
        for (const part of ref.$ref.split(".")) {
            at = at !== null && typeof at === "object" && !Array.isArray(at) ? (at as Record<string, JsonValue>)[part] : undefined
        }
        return at === undefined ? (ref.default ?? null) : at
    }

/** The output a node's own example answers, found by a member of it. */
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

const understood = (branch: string) => exampleOutput(websalesUnderstandNode.examples, (output) => output["branch"] === branch)
// The understand step's examples answer ask, quote and agree; `paid` and `no` are the same shape on another route of its enum.
const paidOrNo = (branch: "paid" | "no") => ({ ...understood("agree"), branch })
const opened = (quoted: boolean) => exampleOutput(websalesPurchaseOpenNode.examples, (output) => output["quoted"] === quoted)
const talkEnded = (last: JsonValue) => ({ steps: { talk: { output: { rounds: 2, stopped: true, last } } } })

describe("websales.enquiry v8: the conversation as one run (R53)", () => {
    const until = conditionOf("talk", "until")
    const ends = (scope: Readonly<Record<string, JsonValue>>): boolean => exprHolds(until, readerOf(scope))

    it("is the talk loop of at most 30 rounds; round 1 takes the hand-off, later rounds wait for a Zalo message a day at most", () => {
        expect(steps.find((one) => one.key === "talk")).toMatchObject({
            kind: "loop",
            params: { mode: "until", max: 30 },
            next: "settled",
            routes: { exhausted: "quiet" },
        })
        expect(steps.find((one) => one.key === "opening")).toMatchObject({ routes: { yes: "message", no: "hear" } })
        expect(steps.find((one) => one.key === "hear")).toMatchObject({ kind: "wait", params: { timeout: { days: 1 } }, routes: { zalo: "desk" } })
    })

    it("a later message is judged by the front door's own step: a new purchase goes on, anything else is handed back", () => {
        expect(steps.find((one) => one.key === "desk")).toMatchObject({
            step: webdeskUnderstandSalesNode.id,
            routes: { sales: "message", fault: "give-back", renewal: "give-back", complaint: "give-back", question: "give-back" },
        })
        expect(steps.find((one) => one.key === "give-back")).toMatchObject({ kind: "hand-back", params: { wait: "hear" } })
        // A round handed back leaves the understand step of an earlier round (ask) in the run's state: the talk goes on.
        const fault = exampleOutput(webdeskUnderstandSalesNode.examples, (output) => output["branch"] !== "sales")
        expect(ends({ steps: { desk: { output: fault }, understand: { output: understood("ask") }, open: { output: opened(false) } } })).toBe(false)
    })

    it("ask and quote end the round and the talk waits; a yes with no quote held asks (v7's has-quote)", () => {
        expect(ends({ steps: { understand: { output: understood("ask") }, open: { output: opened(false) } } })).toBe(false)
        expect(ends({ steps: { understand: { output: understood("quote") }, open: { output: opened(false) } } })).toBe(false)
        expect(ends({ steps: { understand: { output: understood("agree") }, open: { output: opened(false) } } })).toBe(false)
        expect(steps.find((one) => one.key === "has-quote")).toMatchObject({ routes: { no: "ask" } })
    })

    it("a yes to a held quote, paid and no end the talk; the steps after it route by the understand step that ended it", () => {
        expect(ends({ steps: { understand: { output: understood("agree") }, open: { output: opened(true) } } })).toBe(true)
        expect(ends({ steps: { understand: { output: paidOrNo("paid") } } })).toBe(true)
        expect(ends({ steps: { understand: { output: paidOrNo("no") } } })).toBe(true)
        const settled = conditionOf("settled", "when")
        const agree = conditionOf("agree-said", "when")
        const paid = conditionOf("paid-said", "when")
        expect(exprHolds(settled, readerOf(talkEnded(understood("agree"))))).toBe(true)
        expect(exprHolds(agree, readerOf(talkEnded(understood("agree"))))).toBe(true)
        expect(exprHolds(agree, readerOf(talkEnded(paidOrNo("paid"))))).toBe(false)
        expect(exprHolds(paid, readerOf(talkEnded(paidOrNo("paid"))))).toBe(true)
        expect(exprHolds(paid, readerOf(talkEnded(paidOrNo("no"))))).toBe(false)
        expect(steps.find((one) => one.key === "paid-said")).toMatchObject({ routes: { yes: "paid-reply", no: "lose" } })
        // The steps after the talk read the ending round's message and purchase from `last` (the understand step echoes its message).
        expect(understood("agree")["text"]).toBe("Ok chot goi do")
        expect(JSON.stringify((steps.find((one) => one.key === "lose") as { params: unknown }).params)).toContain("steps.talk.output.last.text")
    })

    it("a person declining a blocking step of a round stops the talk, as it stopped the run in v7, and the run ends declined", () => {
        const declinedAsk = exampleOutput(websalesAskNode.examples, (output) => output["declined"] === true)
        expect(ends({ steps: { ask: { output: declinedAsk }, understand: { output: understood("ask") } } })).toBe(true)
        // R68 (v9): no notice step ends the round any more; the declined step's OWN output is the loop's `last` (the engine told the team).
        expect(exprHolds(conditionOf("settled", "when"), readerOf(talkEnded(declinedAsk)))).toBe(false)
        expect(exprHolds(conditionOf("declined-said", "when"), readerOf(talkEnded(declinedAsk)))).toBe(true)
        expect(steps.find((one) => one.key === "ask")).toMatchObject({ unsuccessful: { then: "continue" } })
        expect(steps.find((one) => one.key === "declined-said")).toMatchObject({ routes: { yes: "declined", no: "quiet" } })
    })

    it("a day without a message ends the talk quiet, with no notice (a later message starts at the front door, as in v7)", () => {
        expect(ends({ steps: { hear: { output: { trigger: "timeout" } } } })).toBe(true)
        // A timeout round runs control steps only: `last` is null, so neither an ending route nor a declined notice is read.
        expect(exprHolds(conditionOf("settled", "when"), readerOf(talkEnded(null)))).toBe(false)
        expect(exprHolds(conditionOf("declined-said", "when"), readerOf(talkEnded(null)))).toBe(false)
        expect(enquiryGraph.spec.outcomes.map((end) => end.key).toSorted()).toEqual(["agreed", "declined", "lost", "quiet"])
    })
})
