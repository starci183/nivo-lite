import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { ContextVersionRecord, NewContextVersion } from "./module-context-versions.contracts"
import {
    FIND_CONTEXT_VERSION,
    FIND_LATEST_CONTEXT_VERSION,
    INSERT_CONTEXT_VERSION,
    LIST_CONTEXT_VERSIONS,
} from "./persistence/module-context-versions.sql"
import { ContextVersionsService } from "./context-versions.service"

const snapshot: ContextVersionRecord["snapshot"] = {
    summary: "A tea shop in Hue",
    facts: [{ key: "city", text: "Hue" }],
    gates: { tone: { status: "confirmed", evidence: "warm" } },
}

const version: ContextVersionRecord = {
    id: "ver-1",
    installationId: "inst-1",
    version: 2,
    snapshot,
    appliedBy: "Lan",
    appliedAt: "2026-10-12T10:00:00.000Z",
}

const created: NewContextVersion = {
    workspaceId: "ws-1",
    installationId: "inst-1",
    version: 2,
    snapshot,
    appliedBy: "Lan",
}

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [ContextVersionsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(ContextVersionsService)
}

describe("ContextVersionsService", () => {
    it("lists the versions of an installation, newest first", async () => {
        const em = mockEntityManager({ query: [LIST_CONTEXT_VERSIONS, [version]] })

        await expect((await build(em)).list("inst-1")).resolves.toEqual([version])

        expect(em.query).toHaveBeenCalledWith(LIST_CONTEXT_VERSIONS, ["inst-1"])
    })

    it("finds one version by id", async () => {
        const em = mockEntityManager({ query: [FIND_CONTEXT_VERSION, [version]] })

        await expect((await build(em)).find("ver-1")).resolves.toEqual(version)

        expect(em.query).toHaveBeenCalledWith(FIND_CONTEXT_VERSION, ["ver-1"])
    })

    it("answers nothing when the version id is unknown", async () => {
        const em = mockEntityManager({ query: [FIND_CONTEXT_VERSION, []] })

        await expect((await build(em)).find("missing")).resolves.toBeNull()
    })

    it("finds the newest version of an installation", async () => {
        const em = mockEntityManager({ query: [FIND_LATEST_CONTEXT_VERSION, [version]] })

        await expect((await build(em)).latest("inst-1")).resolves.toEqual(version)

        expect(em.query).toHaveBeenCalledWith(FIND_LATEST_CONTEXT_VERSION, ["inst-1"])
    })

    it("answers nothing before the first apply", async () => {
        const em = mockEntityManager({ query: [FIND_LATEST_CONTEXT_VERSION, []] })

        await expect((await build(em)).latest("inst-1")).resolves.toBeNull()
    })

    it("stores an immutable version", async () => {
        const em = mockEntityManager({ query: [INSERT_CONTEXT_VERSION, [version]] })

        await expect((await build(em)).insert(created)).resolves.toEqual(version)

        expect(em.query).toHaveBeenCalledWith(INSERT_CONTEXT_VERSION, [
            "ws-1",
            "inst-1",
            2,
            JSON.stringify(snapshot),
            "Lan",
        ])
    })
})
