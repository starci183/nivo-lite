import { nodeListMismatches } from "./node-examples"
import {
    flatEffect,
    lookTool,
    lostEffect,
    pingEffect,
    probeNode,
    swallowNode,
    unflatEffect,
    unpingEffect,
} from "./probe-nodes"

describe("the probe nodes", () => {
    it("hold every example they promise over the fake ports", async () => {
        await expect(
            nodeListMismatches(
                [probeNode, swallowNode],
                [pingEffect, unpingEffect, lostEffect, flatEffect, unflatEffect],
                [lookTool],
            ),
        ).resolves.toEqual({})
    })

    it("compensate an effect through the effect their definition names", () => {
        expect([pingEffect.compensation, lostEffect.compensation, flatEffect.compensation]).toEqual([
            "core.unping",
            "core.gone",
            "core.unflat",
        ])
        expect(unflatEffect.payload.parse({ id: "a" })).toBe("a")
    })
})
