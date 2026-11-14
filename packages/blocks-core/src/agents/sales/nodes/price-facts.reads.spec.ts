import { TOOL } from "@nivo-lite/agent-sdk/names"
import { NodeBusinessFailure } from "@nivo-lite/agent-sdk/node"
import type { FailReason, NodeContext } from "@nivo-lite/agent-sdk/template"
import { answered } from "../../../shared/nodes/tool-answers"
import type { DraftLine } from "./consult.draft"
import { PRICE_FACT_LIST, pricedLinesOf, priceFactsOf, type PricedFact } from "./price-facts.reads"

const FACT = (id: string, num: number | null, extra: Record<string, unknown> = {}) => ({
    id,
    subject: "basket",
    attribute: "price",
    value: "55.000 d",
    unit: null,
    num,
    trust: 95,
    ...extra,
})

const contextOf = (facts: ReadonlyArray<unknown>): Pick<NodeContext, "fail" | "tools"> => ({
    tools: { call: () => Promise.resolve(answered({ facts: facts as never })) } as never,
    fail: (reason: FailReason): never => {
        throw new NodeBusinessFailure({ code: reason.kind, messageKey: "specStop", message: JSON.stringify(reason), fields: {} })
    },
})

describe("priceFactsOf", () => {
    it("asks the truth list once and keeps the truths whose figure is a whole, non-negative number", async () => {
        const asked: Array<unknown> = []
        const context = {
            ...contextOf([FACT("a", 55_000), FACT("b", null), FACT("c", 1.5), FACT("d", -3), FACT("e", 0)]),
            tools: {
                call: (id: string, args: unknown) => {
                    asked.push([id, args])
                    return Promise.resolve(
                        answered({ facts: [FACT("a", 55_000), FACT("b", null), FACT("c", 1.5), FACT("d", -3), FACT("e", 0)] }),
                    )
                },
            } as never,
        }
        const facts = await priceFactsOf(context)
        expect(asked).toEqual([[TOOL.brainFactList, PRICE_FACT_LIST]])
        expect(facts.map((fact) => [fact.id, fact.num])).toEqual([
            ["a", 55_000],
            ["e", 0],
        ])
    })

    it("stops the node on an answer of an unknown shape", async () => {
        await expect(priceFactsOf(contextOf([{ id: 1 }]))).rejects.toMatchObject({
            failure: { message: expect.stringContaining("unknown shape") },
        })
    })
})

describe("pricedLinesOf", () => {
    const facts: ReadonlyArray<PricedFact> = [{ id: "a", subject: "basket", attribute: "price", value: "55.000 d", unit: null, num: 55_000 }]
    const line = (extra: Partial<DraftLine>): DraftLine => ({ name: "basket", quantity: 2, unitVnd: 50_000, ...extra })

    it("copies the figure of the fact a line names, never the agent's, and keeps the source", () => {
        expect(pricedLinesOf([line({ priceSource: { kind: "fact", id: "a" } })], facts)).toEqual([
            { name: "basket", quantity: 2, unitVnd: 55_000, priceSource: { kind: "fact", id: "a" } },
        ])
    })

    it("keeps the agent's price with no source for a fact the read does not hold, a null source and a source of another kind", () => {
        expect(
            pricedLinesOf(
                [line({ priceSource: { kind: "fact", id: "zz" } }), line({ priceSource: null }), line({ priceSource: { kind: "crm", id: "a" } }), line({})],
                facts,
            ),
        ).toEqual([
            { name: "basket", quantity: 2, unitVnd: 50_000 },
            { name: "basket", quantity: 2, unitVnd: 50_000 },
            { name: "basket", quantity: 2, unitVnd: 50_000 },
            { name: "basket", quantity: 2, unitVnd: 50_000 },
        ])
    })
})
