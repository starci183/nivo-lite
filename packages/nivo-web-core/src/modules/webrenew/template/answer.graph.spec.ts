import type { StoredExpr, StoredRef } from "@nivo-lite/agent-sdk/graph"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { exprHolds } from "@nivo-lite/agent-sdk/template"
import { webdeskUnderstandSalesNode } from "../../../nodes/webdesk/understand-sales.node"
import { webrenewReplyAnswerNode } from "../../../nodes/webrenew/reply-answer.node"
import { webrenewUnderstandOpenNode } from "../../../nodes/webrenew/understand-open.node"
import { answerGraph } from "./answer.graph"

// R53 (owner 2026-11-14: "a conversation is ONE run"; business kept, form converted): `webrenew.answer` v14 is v13's steps around a talk
// loop. These cases evaluate the STORED conditions (the talk's `until`, the routing after it) against the nodes' OWN example outputs, as
// the engine records them (R46: a loop's `last` = the output of the last NODE step of the final round). Importing the graph builds it.

const steps = answerGraph.spec.nodes

const conditionOf = (key: string, member: "when" | "until"): StoredExpr => {
    const step = steps.find((one) => one.key === key) as { readonly params: Readonly<Record<string, StoredExpr>> } | undefined
    const found = step?.params[member]
    if (found === undefined) throw new Error(`no ${member} on ${key}`)
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

const understood = (branch: string) => exampleOutput(webrenewUnderstandOpenNode.examples, (output) => output["branch"] === branch)
// The understand step's examples answer agree, paid and ask; `no` is the same shape on another route of its enum.
const said = (branch: string) => (branch === "no" ? { ...understood("agree"), branch } : understood(branch))
const talkEnded = (last: JsonValue) => ({ steps: { talk: { output: { rounds: 2, stopped: true, last } } } })
const holds = (key: string, member: "when" | "until", scope: Readonly<Record<string, JsonValue>>): boolean =>
    exprHolds(conditionOf(key, member), readerOf(scope))

describe("webrenew.answer v14: the conversation as one run (R53)", () => {
    it("a later message is judged by the front door's own step: a renewal goes on, anything else is handed back", () => {
        expect(steps.find((one) => one.key === "desk")).toMatchObject({
            step: webdeskUnderstandSalesNode.id,
            routes: { renewal: "message", fault: "give-back", sales: "give-back", complaint: "give-back", question: "give-back" },
        })
        expect(steps.find((one) => one.key === "talk")).toMatchObject({ params: { mode: "until", max: 30 }, routes: { exhausted: "answered" } })
    })

    it("an answered question ends the round and the talk waits; agree, paid and no end the talk", () => {
        expect(holds("talk", "until", { steps: { understand: { output: understood("ask") } } })).toBe(false)
        for (const branch of ["agree", "paid", "no"]) {
            expect(holds("talk", "until", { steps: { understand: { output: said(branch) } } })).toBe(true)
        }
    })

    it("after the talk the ending route is read from `last`: agree quotes, paid tells, no closes; the round's message is echoed", () => {
        expect(holds("settled", "when", talkEnded(said("agree")))).toBe(true)
        expect(holds("agree-said", "when", talkEnded(said("agree")))).toBe(true)
        expect(holds("agree-said", "when", talkEnded(said("paid")))).toBe(false)
        expect(holds("paid-said", "when", talkEnded(said("paid")))).toBe(true)
        expect(holds("paid-said", "when", talkEnded(said("no")))).toBe(false)
        expect(steps.find((one) => one.key === "paid-said")).toMatchObject({ routes: { yes: "paid-team", no: "close-each" } })
        expect(said("paid")["text"]).toBe("Em chuyen khoan roi nhe")
    })

    it("a person declining the reply stops the talk and the run ends declined, as in v13", () => {
        const declined = exampleOutput(webrenewReplyAnswerNode.examples, (output) => output["declined"] === true)
        expect(holds("talk", "until", { steps: { reply: { output: declined }, understand: { output: understood("ask") } } })).toBe(true)
        // R68: no notice node ends the round any more (the ENGINE tells the team); the round's last node step is the declined reply
        // itself (`reply-declined` ends the round), and `declined-said` reads its `declined`.
        expect(holds("settled", "when", talkEnded(declined))).toBe(false)
        expect(holds("declined-said", "when", talkEnded(declined))).toBe(true)
        const answered = exampleOutput(webrenewReplyAnswerNode.examples, (output) => output["declined"] === false)
        expect(holds("declined-said", "when", talkEnded(answered))).toBe(false)
        expect(steps.find((one) => one.key === "reply")).toMatchObject({ next: "reply-declined", unsuccessful: { then: "continue" } })
    })

    it("a day without a message after an answered question ends `answered` (v13's outcome of that message), with no notice", () => {
        expect(holds("talk", "until", { steps: { hear: { output: { trigger: "timeout" } }, understand: { output: understood("ask") } } })).toBe(true)
        expect(holds("settled", "when", talkEnded(null))).toBe(false)
        expect(holds("declined-said", "when", talkEnded(null))).toBe(false)
        expect(answerGraph.spec.outcomes.map((end) => end.key).toSorted()).toEqual(["answered", "declined"])
    })
})
