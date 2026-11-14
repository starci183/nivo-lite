import type { StoredExpr, StoredRef } from "@nivo-lite/agent-sdk/graph"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { exprHolds } from "@nivo-lite/agent-sdk/template"
import { webrenewRenewNode } from "../../../nodes/webrenew/renew.node"
import { webrenewRenewRecheckNode } from "../../../nodes/webrenew/renew-recheck.node"
import { webrenewRenewRecordNode } from "../../../nodes/webrenew/renew-record.node"
import { webrenewRenewedTeamNode } from "../../../nodes/webrenew/renewed-team.node"
import { renewGraph } from "./renew.graph"

// R57 (owner ruling): `webrenew.renew` v13 renews at the registrar and records the answer in the CRM; the team is told on every path,
// the customer and Accounting only on `renewed`. These cases evaluate the STORED conditions against the nodes' OWN example outputs.
// R68: a declined registrar call is the step's unsuccessful ending (the ENGINE tells the team and the run ends `declined`): the
// `renew-declined` if and `renew-notice` are gone; past `renew` only a non-declined answer reaches `record` (the save check's narrowing).

const steps = renewGraph.spec.nodes

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

/** The renew step's example output of an outcome (or the declined one, for `null`). */
const renewed = (outcome: string | null) =>
    exampleOutput(webrenewRenewNode.examples, (output) =>
        outcome === null ? output["declined"] === true : output["outcome"] === outcome,
    )
const teamPosted = exampleOutput(webrenewRenewedTeamNode.examples, (output) => output["declined"] === false)
const teamDeclined = exampleOutput(webrenewRenewedTeamNode.examples, (output) => output["declined"] === true)
const holds = (key: string, scope: Readonly<Record<string, JsonValue>>): boolean => exprHolds(conditionOf(key), readerOf(scope))
const scopeOf = (renew: Record<string, JsonValue>, team: Record<string, JsonValue> = teamPosted) => ({
    steps: { renew: { output: renew }, settle: { output: { last: renew } }, "renewed-team": { output: team } },
})

describe("webrenew.renew v14: the registrar renews, a pending order is read again, the CRM records (R57, E-R57)", () => {
    it("runs check -> renew -> settle -> record -> team line, and routes the yes of `renewed-check` to the customer and Accounting only", () => {
        expect(steps[0]?.key).toBe("check")
        expect(stepOf("check")).toMatchObject({ next: "renew" })
        expect(stepOf("renew")).toMatchObject({ next: "settle" })
        expect(stepOf("settled")).toMatchObject({ routes: { yes: "record", no: "not-renewed" } })
        expect(stepOf("record")).toMatchObject({ next: "renewed-team" })
        expect(stepOf("renewed-team-declined")).toMatchObject({ routes: { yes: "declined", no: "renewed-check" } })
        expect(stepOf("renewed-check")).toMatchObject({ routes: { yes: "renewed-tell", no: "not-renewed" } })
        expect(stepOf("renewed-tell")).toMatchObject({ next: "to-invoice" })
        expect(renewGraph.spec.outcomes.map((end) => end.key).toSorted()).toEqual(["declined", "not-renewed", "renewed"])
    })

    it("a pending order is read again by `settle`: a bounded loop (8 rounds, 30 minutes apart) that ends when it is no longer pending", () => {
        const settle = stepOf("settle") as unknown as { readonly params: Record<string, unknown>; readonly next?: string; readonly routes?: Record<string, string> }
        expect(settle.params).toMatchObject({ mode: "until", max: 8, every: { minutes: 30 } })
        expect(JSON.stringify(settle)).toContain("settled")
        const until = settle.params["until"] as StoredExpr
        const pendingNow = readerOf({ steps: { recheck: { output: renewed("pending") } } })
        const renewedNow = readerOf({ steps: { recheck: { output: renewed("renewed") } } })
        expect(exprHolds(until, pendingNow)).toBe(false)
        expect(exprHolds(until, renewedNow)).toBe(true)
    })

    it("the recheck step reads with `nivo.tool.domain.renewal.get`, mode auto, on the registrars; its examples renew, keep pending and pass others through", () => {
        expect(webrenewRenewRecheckNode.tools).toEqual(["nivo.tool.domain.renewal.get"])
        expect(webrenewRenewRecheckNode.mode).toBe("auto")
        const outcomes = webrenewRenewRecheckNode.examples.flatMap((example) =>
            "output" in example ? [(example.output as { outcome: string }).outcome] : [],
        )
        expect(outcomes).toEqual(["renewed", "pending", "pending", "renewed"])
    })

    it("the renewed path: not declined, the team told, the customer told and Accounting called", () => {
        const scope = scopeOf(renewed("renewed"))
        expect(holds("renewed-team-declined", scope)).toBe(false)
        expect(holds("renewed-check", scope)).toBe(true)
    })

    it("pending, refused and not renewable: the team told, then `not-renewed` (no customer line, no invoice)", () => {
        for (const outcome of ["pending", "refused", "not_renewable"]) {
            const scope = scopeOf(renewed(outcome))
            expect([outcome, holds("renewed-team-declined", scope)]).toEqual([outcome, false])
            expect([outcome, holds("renewed-check", scope)]).toEqual([outcome, false])
        }
    })

    it("a declined registrar call is the step's unsuccessful ending: the engine tells the team the service's code and ends `declined`", () => {
        // the node's own example of a person's decline exists (the engine reads it as the declined answer)
        expect(renewed(null)).toMatchObject({ declined: true, outcome: null })
        expect(stepOf("renew")).toMatchObject({
            unsuccessful: {
                then: "end",
                outcome: "declined",
                facts: [{ label: { vi: "Mã dịch vụ", en: "Service" }, value: expect.objectContaining({ $ref: "trigger.data.serviceCode" }) }],
            },
        })
        expect(steps.some((one) => one.key === "renew-declined" || one.key === "renew-notice")).toBe(false)
    })

    it("a declined team post ends `declined`, before the customer is told", () => {
        expect(holds("renewed-team-declined", scopeOf(renewed("renewed"), teamDeclined))).toBe(true)
    })

    it("the record step's own examples write the outcome for every path, a not renewable one (hosting, SSL) as pending for a manual renewal (R83)", () => {
        const outputs = webrenewRenewRecordNode.examples.flatMap((example) => ("output" in example ? [example.output] : []))
        expect(outputs).toContainEqual({ recorded: true, state: "renewed" })
        expect(outputs).toContainEqual({ recorded: true, state: "pending_person" })
        expect(outputs).not.toContainEqual({ recorded: false, state: null })
        expect(outputs.filter((one) => one?.recorded === true).length).toBe(4)
    })
})
