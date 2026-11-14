import { z } from "zod"
import { thrownFailureOf } from "../../tests/thrown-failure"
import { defineBlock } from "../../block/block"
import { defineRenderer } from "./define-renderer"
import { RendererError } from "./renderer-error"
import { rendererOf } from "./renderer-of"

const BLOCK = defineBlock({
    id: "test.plain",
    title: { key: "t" },
    props: z.object({}),
    slots: {},
    children: false,
})
const RENDERERS = [defineRenderer(BLOCK, () => null)]

describe("rendererOf", () => {
    it("finds the renderer of a block by its id", () => {
        expect(rendererOf(RENDERERS, "test.plain")).toBe(RENDERERS[0])
    })

    it("refuses a package that lists no renderer for the block, naming the block", () => {
        expect(() => rendererOf(RENDERERS, "test.other")).toThrow(RendererError)
        expect(thrownFailureOf(() => rendererOf([], "test.other"))).toEqual({ code: "RENDERER_MISSING", at: "test.other" })
    })
})
