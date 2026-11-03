import { specRegistryFrom, defineWorkbench, viewIdOf, workbenchProblems, workbenchRegistryOf } from "./workbench"
import type { WorkbenchModule } from "./workbench.types"

const Component = (): null => null

const MODULE: WorkbenchModule = {
    key: "loyalty",
    namespace: "loyalty",
    views: [
        { id: "overview", labelKey: "tab_overview" },
        { id: "rewards", labelKey: "tab_rewards", permission: "loyalty.manage" },
    ],
    permissions: ["loyalty.manage"],
    operations: ["loyaltyBoard"],
    render: { kind: "component", Component },
}

describe("workbenchProblems", () => {
    it("accepts a module whose views and permissions agree", () => {
        expect(workbenchProblems(MODULE)).toEqual([])
    })

    it("refuses a duplicate view and a permission the module does not declare", () => {
        const module: WorkbenchModule = {
            ...MODULE,
            views: [
                { id: "overview", labelKey: "a" },
                { id: "overview", labelKey: "b", permission: "loyalty.secret" },
            ],
        }
        expect(workbenchProblems(module)).toEqual([
            { code: "WORKBENCH_VIEW_DUPLICATE", at: "loyalty.overview" },
            { code: "WORKBENCH_PERMISSION_UNDECLARED", at: "loyalty.overview" },
        ])
    })

    it("refuses a default spec of another module", () => {
        const module: WorkbenchModule = {
            ...MODULE,
            render: {
                kind: "spec",
                document: {
                    schema: "nivo/workbench-spec@1",
                    module: "sales",
                    views: [{ id: "overview", label: { key: "tab_overview" }, root: { id: "root", block: "waiting" } }],
                },
            },
        }
        expect(workbenchProblems(module)).toEqual([{ code: "WORKBENCH_SPEC_FOREIGN", at: "loyalty" }])
    })
})

describe("defineWorkbench", () => {
    it("returns a sound module as declared", () => {
        expect(defineWorkbench(MODULE)).toBe(MODULE)
    })

    it("throws on the first problem", () => {
        expect(() => defineWorkbench({ ...MODULE, permissions: [] })).toThrow(
            "WORKBENCH_PERMISSION_UNDECLARED: loyalty.rewards",
        )
    })
})

describe("workbenchRegistryOf", () => {
    it("keys the workbenches", () => {
        expect(workbenchRegistryOf([MODULE])).toEqual({ loyalty: MODULE })
    })

    it("refuses two workbenches under one key", () => {
        expect(() => workbenchRegistryOf([MODULE, MODULE])).toThrow("WORKBENCH_KEY_DUPLICATE: loyalty")
    })
})

describe("viewIdOf", () => {
    it("opens the view the deep link names, else the first", () => {
        expect(viewIdOf(MODULE, "rewards")).toBe("rewards")
        expect(viewIdOf(MODULE, "nope")).toBe("overview")
        expect(viewIdOf(MODULE, null)).toBe("overview")
    })
})

describe("exposures", () => {
    const read = {
        name: "loyalty.board",
        module: "loyalty",
        operation: "loyaltyBoard",
        shape: "record" as const,
        variables: {},
        paths: {},
    }
    const action = {
        name: "loyalty.open",
        module: "loyalty",
        operation: "open",
        permission: "loyalty.manage",
        label: { key: "o" },
    }

    it("refuses an exposed read or action outside the module's operations or of another module", () => {
        const module: WorkbenchModule = {
            ...MODULE,
            exposes: { blocks: [], reads: [read, { ...read, name: "x", module: "sales" }], actions: [action] },
        }
        expect(workbenchProblems(module)).toEqual([
            { code: "WORKBENCH_EXPOSES_UNDECLARED", at: "loyalty.x" },
            { code: "WORKBENCH_EXPOSES_UNDECLARED", at: "loyalty.loyalty.open" },
        ])
    })

    it("assembles the spec registry from the SDK's blocks and every declaration's exposures", () => {
        const block = { name: "loyalty-tier-card", props: {}, slots: {}, children: false }
        const registry = specRegistryFrom([
            MODULE,
            { ...MODULE, key: "x", exposes: { blocks: [block], reads: [read], actions: [action] } },
        ])
        expect(registry.blocks["loyalty-tier-card"]).toBe(block)
        expect(registry.blocks["stack"]?.children).toBe(true)
        expect(registry.reads["loyalty.board"]).toBe(read)
        expect(registry.actions["loyalty.open"]).toBe(action)
    })
})
