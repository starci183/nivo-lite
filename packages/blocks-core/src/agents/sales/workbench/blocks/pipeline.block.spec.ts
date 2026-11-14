import { pipelineFixtureProps } from "../fixtures/pipeline.fixtures"
import { salesPipelineBlock } from "./pipeline.block"
import { salesBlocks } from "./sales-blocks"

describe("sales.pipeline", () => {
    it("takes the words of the board and the names of the two params it writes", () => {
        expect(salesPipelineBlock.props.safeParse(pipelineFixtureProps).success).toBe(true)
        expect(salesPipelineBlock.params).toEqual(["selectParam", "searchParam"])
    })

    it("narrows the stages to ones it knows, at least one", () => {
        const accepts = (stages: ReadonlyArray<string>): boolean =>
            salesPipelineBlock.props.safeParse({ ...pipelineFixtureProps, stages }).success
        expect(accepts(["new", "won"])).toBe(true)
        expect(accepts(["archived"])).toBe(false)
        expect(accepts([])).toBe(false)
    })

    it("binds the leads, optionally the counts and the move", () => {
        expect(Object.keys(salesPipelineBlock.slots)).toEqual(["rows", "counts", "move"])
        expect(salesPipelineBlock.slots.counts.required).toBe(false)
        expect(salesBlocks).toContain(salesPipelineBlock)
    })
})
