import { cursorScopeOf } from "./cursor-scope"

describe("cursorScopeOf", () => {
    it("is a stable hash of 28 hex digits", () => {
        const scope = cursorScopeOf("sales.leads", { stage: "won" }, "recent")
        expect(scope).toMatch(/^[0-9a-f]{28}$/)
        expect(cursorScopeOf("sales.leads", { stage: "won" }, "recent")).toBe(scope)
    })

    it("differs by read, filters and sort", () => {
        const base = cursorScopeOf("sales.leads", { stage: "won" }, "recent")
        expect(cursorScopeOf("sales.other", { stage: "won" }, "recent")).not.toBe(base)
        expect(cursorScopeOf("sales.leads", { stage: "lost" }, "recent")).not.toBe(base)
        expect(cursorScopeOf("sales.leads", {}, "recent")).not.toBe(base)
        expect(cursorScopeOf("sales.leads", { stage: "won" }, "name")).not.toBe(base)
    })

    it("does not depend on the order the filters were written in", () => {
        const forward = cursorScopeOf("r", { a: "1", b: "2", c: "3" }, "s")
        expect(cursorScopeOf("r", { c: "3", b: "2", a: "1" }, "s")).toBe(forward)
        expect(cursorScopeOf("r", { b: "2", c: "3", a: "1" }, "s")).toBe(forward)
    })

    it("hashes non-ASCII text", () => {
        expect(cursorScopeOf("r", { q: "\u0110inh" }, "s")).not.toBe(cursorScopeOf("r", { q: "dinh" }, "s"))
    })
})
