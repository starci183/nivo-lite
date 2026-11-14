import { SandboxCatalogueRegistryService } from "./sandbox-catalogue-registry.service"

describe("SandboxCatalogueRegistryService", () => {
    it("merges the catalogues of one account provider and lets a case id registered again replace its case", () => {
        const registry = new SandboxCatalogueRegistryService()
        registry.register({ provider: "google", cases: [{ id: "YOUTUBE-1", label: "uploaded" }] })
        registry.register({ provider: "google", cases: [{ id: "GCAL-1", label: "week" }] })
        registry.register({ provider: "google", cases: [{ id: "YOUTUBE-1", label: "uploaded, then processed" }] })

        expect(registry.casesOf("google").map((one) => [one.id, one.label])).toEqual([
            ["GCAL-1", "week"],
            ["YOUTUBE-1", "uploaded, then processed"],
        ])
        expect(registry.caseOf("google", "GCAL-1")?.label).toBe("week")
        expect(registry.caseOf("google", "NOPE-1")).toBeNull()
        expect(registry.casesOf("inet")).toEqual([])
        expect(registry.providers()).toEqual(["google"])
    })
})
