import { PARAMETERS, draftOf, leakyGraph, packageOf } from "../testing"
import { instantiate, resolveValues } from "./parameters"

const pkg = () => packageOf(leakyGraph(), draftOf())
const decideOf = (graph: ReturnType<typeof instantiate>) => graph.nodes.find((node) => node.key === "decide")?.decide

describe("resolveValues", () => {
    it("takes the default for a value the buyer left out", () => {
        const resolved = resolveValues(PARAMETERS, {})

        expect(resolved.problems).toEqual([])
        expect(resolved.values).toEqual({ autoLimit: 5_000_000, waitMinutes: 240, shop: "Spa Linh" })
    })

    it("refuses a number outside its bounds, a wrong kind, a required value left blank and a key the template does not have", () => {
        const resolved = resolveValues(PARAMETERS, { autoLimit: 10, waitMinutes: "soon", shop: 3, extra: 1 })

        expect(resolved.problems).toEqual(
            expect.arrayContaining([
                "extra: not a parameter of this template",
                "autoLimit: below 1000000",
                "waitMinutes: a number is needed",
                "shop: a text is needed",
            ]),
        )
        expect(resolveValues(PARAMETERS, { autoLimit: 99_000_000 }).problems).toContain("autoLimit: above 50000000")
    })
})

describe("instantiate: parameter substitution", () => {
    it("writes the number of the buyer into the condition and the wait of the branches the bindings name", () => {
        const graph = instantiate(pkg(), { autoLimit: 8_000_000, waitMinutes: 90, shop: "Spa Hoa" })

        const small = decideOf(graph)?.branches.find((branch) => branch.key === "small")
        const middle = decideOf(graph)?.branches.find((branch) => branch.key === "middle")
        expect(small?.when).toEqual({ fact: "supplier_payment.amount_vnd", op: "lt", value: 8_000_000 })
        expect(middle?.approver?.timeoutMinutes).toBe(90)
    })

    it("replaces {{key}} in the task and the limits of the contracts and leaves an unknown placeholder alone", () => {
        const graph = instantiate(pkg(), { autoLimit: 8_000_000, waitMinutes: 90, shop: "Spa Hoa" })

        expect(graph.contracts?.[0]?.task).toBe("Pay the supplier of Spa Hoa")
        expect(graph.contracts?.[0]?.limits[0]?.text).toBe("Never above 8000000 without asking")
    })

    it("never changes what a branch does, whatever the values are, and never grants a right", () => {
        const before = pkg()
            .graph.nodes.find((node) => node.key === "decide")
            ?.decide?.branches.map((branch) => branch.then)
        const graph = instantiate(pkg(), { autoLimit: 49_000_000, waitMinutes: 5, shop: "x" })

        expect(decideOf(graph)?.branches.map((branch) => branch.then)).toEqual(before)
        expect(graph.rights).toEqual([])
    })

    it("keeps the provenance of every branch it fills", () => {
        const graph = instantiate(pkg(), { autoLimit: 8_000_000, waitMinutes: 90, shop: "x" })

        expect(
            decideOf(graph)?.branches.some((branch) => branch.sources.some((source) => source.kind === "template")),
        ).toBe(true)
    })
})
