import { salesPipelineBlock } from "../../blocks/sales/pipeline.block"
import { countsView } from "../../rows/filter-tabs"
import { pipelineCardsOf } from "../../rules/sales/pipeline"
import { PIPELINE_RECORDS, pipelineFixtureProps, pipelineFixtures } from "./pipeline.fixtures"

const WORDS = {
    order: "o {count}",
    quote: "q {count}",
    next: "n {count}",
    due: "d {count}",
    owner: "w {count}",
    reason: "r {count}",
}
const FORMATS = { money: String, day: (value: string) => value }

describe("the pipeline fixtures", () => {
    it("are props the block accepts", () => {
        expect(salesPipelineBlock.props.safeParse(pipelineFixtureProps).success).toBe(true)
    })

    it("hold the five states of the pipeline", () => {
        expect(Object.keys(pipelineFixtures)).toEqual(["ready", "loading", "empty", "error", "waiting"])
    })

    it("put a card in every stage and count the stages", () => {
        const cards = pipelineCardsOf(PIPELINE_RECORDS, WORDS, FORMATS)
        expect(cards.map((card) => card.column)).toEqual(["new", "qualified", "proposal", "won", "lost"])
        const counts = pipelineFixtures.ready.counts
        expect("items" in counts && countsView.safeParse(counts.items).success).toBe(true)
    })

    it("hold the quote that waits for the owner in the waiting state", () => {
        const rows = pipelineFixtures.waiting.rows
        expect(rows).toHaveProperty("items")
        expect("items" in rows ? rows.items.map((record) => record.stage) : []).toEqual(["proposal"])
    })
})
