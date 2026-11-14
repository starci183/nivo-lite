import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import type { NodeContext } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../bounds"
import { valueOrCannot } from "../tool-answers"
import type { DraftLine } from "./consult.draft"

/** The most truths one consult is handed (the truth list's own maximum). */
export const PRICE_FACTS_MAX = 50

/** The read of the truths in force of the agent's view (`nivo.tool.brain.fact.list`), one page. */
export const PRICE_FACT_LIST: JsonObject = { limit: PRICE_FACTS_MAX }

/** The longest value of a truth kept. */
const MAX_VALUE = 2000

/** The highest price of one a line takes, VND (the draft line's own bound). */
const UNIT_MAX = 1_000_000_000

/** One truth that carries a number, as the agent is handed it: the truth's line and the figure the store read from its value. */
export interface PricedFact {
    /** The id of the priced record. */
    readonly id: string
    /** What the truth is about, as people write it. */
    readonly subject: string
    /** Which attribute of it, as people write it. */
    readonly attribute: string
    /** The value as written. */
    readonly value: string
    /** The unit written apart from the value, or null. */
    readonly unit: string | null
    /** The whole number the store read from the value (a price "55.000 d" is 55000). */
    readonly num: number
}

const listShape = z.object({
    facts: z
        .array(
            z
                .object({
                    id: z.string().min(1).max(MAX_ID),
                    subject: z.string().max(MAX_LINE),
                    attribute: z.string().max(MAX_LINE),
                    value: z.string().max(MAX_VALUE),
                    unit: z.string().max(MAX_LINE).nullish(),
                    num: z.number().nullish(),
                })
                .loose(),
        )
        .max(PRICE_FACTS_MAX),
})

/**
 * The truths in force that carry a whole, non-negative number (`nivo.tool.brain.fact.list`), or the node stops on an answer it cannot read.
 * Which of them is a price is the agent's reading; code only keeps the ones whose figure a line could take exactly.
 */
export const priceFactsOf = async (context: Pick<NodeContext, "fail" | "tools">): Promise<ReadonlyArray<PricedFact>> => {
    const page = listShape.safeParse(
        valueOrCannot(context, TOOL.brainFactList, await context.tools.call(TOOL.brainFactList, PRICE_FACT_LIST)),
    )
    if (!page.success) return context.fail({ kind: "cannot", why: `${TOOL.brainFactList} answered truths of an unknown shape` })
    return page.data.facts.flatMap((fact): ReadonlyArray<PricedFact> =>
        fact.num !== null && fact.num !== undefined && Number.isInteger(fact.num) && fact.num >= 0 && fact.num <= UNIT_MAX
            ? [{ id: fact.id, subject: fact.subject, attribute: fact.attribute, value: fact.value, unit: fact.unit ?? null, num: fact.num }]
            : [],
    )
}

/**
 * The lines of a draft priced exactly: a line whose `priceSource` names a fact of the read takes that fact's figure as the price of one
 * (copied from the truth, never the model's number) and keeps `{ kind: "fact", id }`; a line naming no fact, or one the read does not hold
 * (or a source of another kind: blocks-core is bound to no CRM), keeps the truth-priced line as the agent wrote it, with no source.
 */
export const pricedLinesOf = (lines: ReadonlyArray<DraftLine>, facts: ReadonlyArray<PricedFact>): ReadonlyArray<DraftLine> =>
    lines.map((line) => {
        const { priceSource, ...rest } = line
        const fact = priceSource?.kind === "fact" ? facts.find((one) => one.id === priceSource.id) : undefined
        return fact === undefined ? rest : { ...rest, unitVnd: fact.num, priceSource: { kind: "fact", id: fact.id } }
    })
