import { draftOf, leakyGraph, packageOf } from "@tests/fixtures/builders/agent-template.builder"
import { runListingChecks } from "./listing-checks.policy"
import type { ListingChecksContext } from "./listing-checks.policy"

const CONTEXT: ListingChecksContext = {
    pluginKeys: new Set(["shop"]),
    allowedRightKinds: new Set(["brain", "customers"]),
    knownTool: (tool) => tool.startsWith("drive."),
    askOnlyActions: new Set<string>(),
    consented: true,
}

const failing = (checks: ReturnType<typeof runListingChecks>): ReadonlyArray<string> =>
    checks.filter((check) => !check.ok).map((check) => check.id)

describe("runListingChecks", () => {
    it("passes a clean package that stays inside its kind of agent", () => {
        const checks = runListingChecks(packageOf(), CONTEXT)

        expect(failing(checks)).toEqual([])
        expect(checks.map((check) => check.id)).toEqual([
            "schema",
            "no_creator_data",
            "plugins",
            "rights",
            "tools",
            "always_ask",
            "likeness_consent",
        ])
    })

    it("fails a package whose hash no longer matches its content, or that the closed schema does not read", () => {
        const pkg = packageOf()

        expect(failing(runListingChecks({ ...pkg, version: 9 }, CONTEXT))).toContain("schema")
        expect(failing(runListingChecks({ ...pkg, format: 2 as never }, CONTEXT))).toContain("schema")
    })

    it("fails a package that leaves something of the creator in its text", () => {
        const pkg = packageOf()
        const dirty = { ...pkg, starterKnowledge: [{ title: "Lien he", body: "Mail boss@shop.vn" }] }

        expect(failing(runListingChecks(dirty, CONTEXT))).toContain("no_creator_data")
    })

    it("fails a plug-in that is not registered, a right the kind of agent does not need and a tool the gateway does not know", () => {
        const withPlugin = packageOf(leakyGraph(), draftOf({ requiresPlugins: [{ key: "ghost", minVersion: 1 }] }))
        const wide = {
            ...packageOf(),
            proposedRights: [{ kind: "payments" as const, scope: "workspace" as const, hide: [], mask: [] }],
        }
        const graph = leakyGraph()
        const tooled = packageOf(
            {
                ...graph,
                nodes: graph.nodes.map((node) =>
                    node.key === "start"
                        ? {
                              ...node,
                              uses: [{ provider: "mcp", tool: "mcp.secret", scope: "read" as const, label: "x" }],
                          }
                        : node,
                ),
            },
            draftOf(),
        )

        expect(failing(runListingChecks(withPlugin, CONTEXT))).toContain("plugins")
        expect(failing(runListingChecks(wide, CONTEXT))).toContain("rights")
        expect(failing(runListingChecks(tooled, CONTEXT))).toContain("tools")
    })

    it("fails a branch that runs alone for an action that must always ask", () => {
        const checks = runListingChecks(packageOf(), { ...CONTEXT, askOnlyActions: new Set(["pay_supplier"]) })

        expect(failing(checks)).toEqual(["always_ask"])
    })

    it("fails a persona of a real person with no valid consent, and passes one that has it", () => {
        const persona = {
            soul: "Than thien",
            likeness: { personName: "Ngoc Trinh", allowedUses: ["name" as const], disclosure: "Tro ly AI" },
        }
        const pkg = packageOf(leakyGraph(), draftOf({ persona }))

        expect(failing(runListingChecks(pkg, { ...CONTEXT, consented: false }))).toEqual(["likeness_consent"])
        expect(failing(runListingChecks(pkg, CONTEXT))).toEqual([])
    })
})
