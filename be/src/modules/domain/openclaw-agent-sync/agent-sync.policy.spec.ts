import { Test } from "@nestjs/testing"
import {
    INTERNAL_FILES,
    scopeOf as scopeOfImplementation,
    syncErrorOf as syncErrorOfImplementation,
} from "./agent-sync.policy"

const SUBJECT = Symbol("subject")
type Subject = {
    scopeOf: typeof scopeOfImplementation
    syncErrorOf: typeof syncErrorOfImplementation
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: SUBJECT, useValue: { scopeOf: scopeOfImplementation, syncErrorOf: syncErrorOfImplementation } },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("agent sync policy", () => {
    it("syncs one installation when the payload names it and its workspace", async () => {
        const subject = await buildSubject()
        expect(subject.scopeOf({ workspaceId: "w1", installationId: "i1" })).toEqual({
            kind: "installation",
            workspaceId: "w1",
            installationId: "i1",
            force: false,
        })
        expect(subject.scopeOf({ workspaceId: "w1", installationId: "i1", force: true })).toMatchObject({ force: true })
    })

    it("ignores an installation without its workspace", async () => {
        const subject = await buildSubject()
        expect(subject.scopeOf({ installationId: "i1" })).toBeNull()
    })

    it("syncs a workspace, or everything for the empty tick", async () => {
        const subject = await buildSubject()
        expect(subject.scopeOf({ workspaceId: "w1" })).toEqual({ kind: "workspace", workspaceId: "w1" })
        expect(subject.scopeOf({})).toEqual({ kind: "all" })
    })

    it("keeps the first five hundred characters of a failure", async () => {
        const subject = await buildSubject()
        expect(subject.syncErrorOf(new Error("e".repeat(600)))).toHaveLength(500)
        expect(subject.syncErrorOf("plain")).toBe("plain")
    })

    it("has the two files of the internal agent", () => {
        expect(INTERNAL_FILES.map((file) => file.path)).toEqual(["AGENTS.md", "SOUL.md"])
    })
})
