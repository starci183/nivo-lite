import { FixtureError } from "./fixture-error"
import { fakeVocabulary, graphOf, nodeOf, packageOf } from "./index"

describe("the testing kit", () => {
    it("builds a whole graph, a package that parses back and a vocabulary with a fake kind", () => {
        expect(graphOf().nodes.map((node) => node.key)).toEqual(["start", "decide", "act", "ask", "end"])
        expect(packageOf().format).toBe(1)
        expect(fakeVocabulary().hasKind("fake")).toBe(true)
        expect(fakeVocabulary().hasProvider("fake-provider")).toBe(true)
    })

    it("refuses to build a package from a graph the packager refuses", () => {
        const refused = { ...graphOf(), nodes: graphOf().nodes.map((node) => ({ ...node, does: "mail boss@shop.vn" })) }

        expect(() => packageOf(refused)).toThrow(FixtureError)
        expect(() => packageOf(refused)).toThrow("the builder graph is refused")
    })

    it("builds a node with every answer filled, and lets a spec change any of them", () => {
        expect(nodeOf().key).toBe("act")
        expect(nodeOf({ key: "other" }).key).toBe("other")
    })
})
