import { z } from "zod"
import { defineBlock } from "../../block/block"
import { UNBOUND_ACTION, UNBOUND_READ, MISSING_READ } from "./inert"
import { defineRenderer } from "./define-renderer"
import { RendererError } from "./renderer-error"

const BLOCK = defineBlock({
    id: "test.label",
    title: { key: "t" },
    props: z.object({ label: z.string().max(100).default("none") }),
    slots: { rows: { kind: "read", shape: "list", required: false } },
    children: false,
})

describe("defineRenderer", () => {
    it("pairs a block with a component that receives props parsed by the block schema", () => {
        const seen: Array<unknown> = []
        const renderer = defineRenderer(BLOCK, (props) => {
            seen.push(props.props.label, props.nodeId, props.slots.rows)
            return null
        })
        expect(renderer.id).toBe("test.label")
        expect(renderer.block).toBe(BLOCK)
        const drawn = renderer.Component({ props: {}, slots: { rows: UNBOUND_READ }, children: null, nodeId: "n1" })
        expect(drawn).toBeNull()
        expect(seen).toEqual(["none", "n1", UNBOUND_READ])
    })

    it("refuses to draw a block whose declared slots are not all handed over", () => {
        const renderer = defineRenderer(BLOCK, () => null)
        const bare = { props: {}, slots: {}, children: null, nodeId: "n1" }
        expect(() => renderer.Component(bare)).toThrow(RendererError)
        expect(() => renderer.Component(bare)).toThrow("RENDERER_SLOTS_MISSING: test.label")
    })
})

describe("the inert handles", () => {
    it("tell an unbound read from a missing one, and refuse to run an unbound action", async () => {
        expect(UNBOUND_READ.slot).toEqual({ isEmpty: true })
        expect(MISSING_READ.slot).toEqual({ isError: true })
        expect(UNBOUND_READ.retry()).toBeUndefined()
        expect(UNBOUND_READ.setVariables({})).toBeUndefined()
        await expect(UNBOUND_ACTION.run({ id: "1" })).resolves.toMatchObject({ ok: false, reason: "failed" })
        expect(UNBOUND_ACTION.isAllowed).toBe(false)
    })
})
