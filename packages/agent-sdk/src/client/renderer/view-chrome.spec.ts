import type { StoredSpec } from "../../spec/spec.types"
import { chromeOf, countChipOf, isAsidePane, paneOf } from "./view-chrome"

describe("chromeOf", () => {
    it("lists the count and command of each view", () => {
        const node = { id: "r", block: "core.stack" as const }
        const spec: StoredSpec = {
            schema: "nivo/workbench-spec@1",
            module: "m",
            views: [
                { id: "a", label: { key: "a" }, root: node, count: { read: "m.counts", path: "total" } },
                { id: "b", label: { key: "b" }, root: node, command: { action: "m.create" } },
            ],
        }
        expect(chromeOf(spec)).toEqual([
            { id: "a", count: { read: "m.counts", path: "total" }, command: undefined },
            { id: "b", count: undefined, command: { action: "m.create" } },
        ])
    })
})

describe("countChipOf", () => {
    const ready = (data: unknown) => ({ status: "ready" as const, data })

    it("is the number at the path of a ready read", () => {
        expect(countChipOf(ready({ total: 4 }), { read: "m.counts", path: "total" })).toEqual({
            count: 4,
            isAttention: false,
        })
    })

    it("reads in the attention tone only when declared and above zero", () => {
        const binding = { read: "m.counts", path: "open", isAttention: true }
        expect(countChipOf(ready({ open: 2 }), binding).isAttention).toBe(true)
        expect(countChipOf(ready({ open: 0 }), binding)).toEqual({ count: 0, isAttention: false })
    })

    it("has no number while the read is not ready or the value is not a number", () => {
        const binding = { read: "m.counts", path: "total" }
        expect(countChipOf({ status: "loading", data: undefined }, binding)).toEqual({ isAttention: false })
        expect(countChipOf({ status: "error", data: undefined }, binding)).toEqual({ isAttention: false })
        expect(countChipOf(ready({ total: "4" }), binding)).toEqual({ isAttention: false })
        expect(countChipOf(ready({ total: Number.NaN }), binding)).toEqual({ isAttention: false })
        expect(countChipOf(ready({}), binding)).toEqual({ isAttention: false })
    })
})

describe("paneOf", () => {
    it("is the detail only when the param says so", () => {
        expect(paneOf("detail")).toBe("detail")
        expect(paneOf("list")).toBe("list")
        expect(paneOf(null)).toBe("list")
        expect(paneOf("other")).toBe("list")
    })
})

describe("isAsidePane", () => {
    it("is true for any pane but the main one", () => {
        expect(isAsidePane("queue")).toBe(true)
        expect(isAsidePane("detail")).toBe(true)
        expect(isAsidePane("list")).toBe(false)
        expect(isAsidePane(null)).toBe(false)
    })
})
