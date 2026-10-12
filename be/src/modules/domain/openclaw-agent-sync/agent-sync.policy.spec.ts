import { INTERNAL_FILES, scopeOf, syncErrorOf } from "./agent-sync.policy"

describe("agent sync policy", () => {
    it("syncs one installation when the payload names it and its workspace", () => {
        expect(scopeOf({ workspaceId: "w1", installationId: "i1" })).toEqual({
            kind: "installation",
            workspaceId: "w1",
            installationId: "i1",
            force: false,
        })
        expect(scopeOf({ workspaceId: "w1", installationId: "i1", force: true })).toMatchObject({ force: true })
    })

    it("ignores an installation without its workspace", () => {
        expect(scopeOf({ installationId: "i1" })).toBeNull()
    })

    it("syncs a workspace, or everything for the empty tick", () => {
        expect(scopeOf({ workspaceId: "w1" })).toEqual({ kind: "workspace", workspaceId: "w1" })
        expect(scopeOf({})).toEqual({ kind: "all" })
    })

    it("keeps the first five hundred characters of a failure", () => {
        expect(syncErrorOf(new Error("e".repeat(600)))).toHaveLength(500)
        expect(syncErrorOf("plain")).toBe("plain")
    })

    it("has the two files of the internal agent", () => {
        expect(INTERNAL_FILES.map((file) => file.path)).toEqual(["AGENTS.md", "SOUL.md"])
    })
})
