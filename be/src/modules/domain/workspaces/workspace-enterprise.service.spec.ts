import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { FIXTURE_ENTERPRISE, FIXTURE_MODULE } from "@tests/fixtures/builders/fixture-plugin.builder"
import { WorkspacesErrorCode } from "./errors/workspaces.error"
import { WorkspaceEntity } from "./persistence/entities"
import { WorkspaceEnterpriseService } from "./workspace-enterprise.service"

// The installation here holds the core plugin and a private fixture plugin bound to the enterprise `fixture-co`.
jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const fixture: typeof import("@tests/fixtures/builders/fixture-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/fixture-plugin.builder",
    )
    return { installed: parts.installationWith([fixture.FIXTURE_PLUGIN], "fixture-array") }
})

const rowOf = (id: string, enterpriseKey: string | null): WorkspaceEntity =>
    Object.assign(new WorkspaceEntity(), { id, enterpriseKey })

/** The `where` of a lookup the store double answers. */
interface FindWhere {
    id?: string
    enterpriseKey?: string
}

/** The options of a lookup the store double answers. */
interface FindOptions {
    where: FindWhere
}

/** The service over a store that holds `rows` (workspace id to identifier). */
const build = async (rows: Readonly<Record<string, string | null>>) => {
    const em = mock<EntityManager>()
    em.findOne.mockImplementation(((_entity: unknown, options: FindOptions) => {
        const { id, enterpriseKey } = options.where
        if (id !== undefined) return Promise.resolve(id in rows ? rowOf(id, rows[id] ?? null) : null)
        const holder = Object.keys(rows).find((key) => rows[key] === enterpriseKey)
        return Promise.resolve(holder === undefined ? null : rowOf(holder, enterpriseKey ?? null))
    }) as never)
    em.transaction.mockImplementation(((work: (tx: EntityManager) => unknown) => Promise.resolve(work(em))) as never)
    const moduleRef = await Test.createTestingModule({
        providers: [WorkspaceEnterpriseService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { service: moduleRef.get(WorkspaceEnterpriseService), em }
}

const ROWS = { "ws-ent": FIXTURE_ENTERPRISE, "ws-other": "other-co", "ws-plain": null }

describe("WorkspaceEnterpriseService", () => {
    it("reads the identifier with an explicit select, and null for an ordinary or unknown workspace", async () => {
        const { service, em } = await build(ROWS)
        await expect(service.keyOf("ws-ent")).resolves.toBe(FIXTURE_ENTERPRISE)
        await expect(service.keyOf("ws-plain")).resolves.toBeNull()
        await expect(service.keyOf("ws-gone")).resolves.toBeNull()
        expect(em.findOne).toHaveBeenCalledWith(WorkspaceEntity, { select: { enterpriseKey: true }, where: { id: "ws-ent" } })
    })

    it("sets, changes and clears the identifier, answering what it was and is", async () => {
        const { service, em } = await build(ROWS)
        await expect(service.set("ws-plain", "new-co")).resolves.toEqual({ from: null, to: "new-co" })
        expect(em.update).toHaveBeenCalledWith(WorkspaceEntity, { id: "ws-plain" }, { enterpriseKey: "new-co" })
        await expect(service.set("ws-ent", null)).resolves.toEqual({ from: FIXTURE_ENTERPRISE, to: null })
        expect(em.update).toHaveBeenLastCalledWith(WorkspaceEntity, { id: "ws-ent" }, { enterpriseKey: null })
    })

    it("writes nothing when the identifier is already the one asked", async () => {
        const { service, em } = await build(ROWS)
        await expect(service.set("ws-ent", FIXTURE_ENTERPRISE)).resolves.toEqual({ from: FIXTURE_ENTERPRISE, to: FIXTURE_ENTERPRISE })
        await expect(service.set("ws-plain", null)).resolves.toEqual({ from: null, to: null })
        expect(em.update).not.toHaveBeenCalled()
    })

    it("refuses a malformed identifier, one another workspace holds, and an unknown workspace, writing nothing", async () => {
        const { service, em } = await build(ROWS)
        await expect(service.set("ws-plain", "Not A Slug")).rejects.toMatchObject({ code: WorkspacesErrorCode.EnterpriseKeyInvalid })
        await expect(service.set("ws-plain", FIXTURE_ENTERPRISE)).rejects.toMatchObject({ code: WorkspacesErrorCode.EnterpriseKeyTaken })
        await expect(service.set("ws-gone", "new-co")).rejects.toMatchObject({ code: WorkspacesErrorCode.NotFound })
        expect(em.update).not.toHaveBeenCalled()
    })

    it("opens a public plugin's module without a read, and a private one's only to the enterprise it names", async () => {
        const { service, em } = await build(ROWS)
        await expect(service.opens("ws-plain", "sales")).resolves.toBe(true)
        expect(em.findOne).not.toHaveBeenCalled()
        await expect(service.opens("ws-plain", FIXTURE_MODULE)).resolves.toBe(false)
        await expect(service.opens("ws-other", FIXTURE_MODULE)).resolves.toBe(false)
        await expect(service.opens("ws-ent", FIXTURE_MODULE)).resolves.toBe(true)
    })

    it("keeps of a list the modules a workspace may see, reading the identifier once and only when a private module is listed", async () => {
        const { service, em } = await build(ROWS)
        const modules = [{ key: "sales" }, { key: FIXTURE_MODULE }, { key: "accounting" }]
        await expect(service.openOf("ws-plain", [{ key: "sales" }])).resolves.toEqual([{ key: "sales" }])
        expect(em.findOne).not.toHaveBeenCalled()
        await expect(service.openOf("ws-ent", modules)).resolves.toEqual(modules)
        expect(em.findOne).toHaveBeenCalledTimes(1)
        await expect(service.openOf("ws-other", modules)).resolves.toEqual([{ key: "sales" }, { key: "accounting" }])
        await expect(service.openOf(null, modules)).resolves.toEqual([{ key: "sales" }, { key: "accounting" }])
        expect(em.findOne).toHaveBeenCalledTimes(2)
    })
})
