import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { WorkspaceEnterpriseService } from "@modules/domain/workspaces"
import { FIXTURE_MODULE } from "@tests/fixtures/builders/fixture-plugin.builder"
import { ModulesErrorCode } from "./errors/modules.error"
import { ModuleAccessService } from "./module-access.service"
import type { ModuleDefinition } from "./modules.contracts"
import { ModulesService } from "./modules.service"

// The installation here holds the core plugin and a private fixture plugin (module `fixdesk`).
jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const fixture: typeof import("@tests/fixtures/builders/fixture-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/fixture-plugin.builder",
    )
    return { installed: parts.installationWith([fixture.FIXTURE_PLUGIN], "fixture-array") }
})

const moduleOf = (key: string): ModuleDefinition => ({ key }) as ModuleDefinition
const SALES = moduleOf("sales")
const DESK = moduleOf(FIXTURE_MODULE)
const CORE = { key: "core", label: { vi: "Nivo", en: "Nivo" } }

const build = async () => {
    const catalog = mock<ModulesService>()
    catalog.catalog.mockResolvedValue({ categories: [], modules: [SALES, DESK] })
    catalog.find.mockImplementation((key) => Promise.resolve(key === "sales" ? SALES : DESK))
    const enterprise = mock<WorkspaceEnterpriseService>()
    const members = mock<WorkspaceMembersService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ModuleAccessService,
            { provide: ModulesService, useValue: catalog },
            { provide: WorkspaceEnterpriseService, useValue: enterprise },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { access: moduleRef.get(ModuleAccessService), catalog, enterprise, members }
}

describe("ModuleAccessService", () => {
    it("shows a member the catalogue their workspace may see, the categories untouched", async () => {
        const { access, enterprise, members } = await build()
        enterprise.openOf.mockResolvedValue([SALES])
        await expect(access.catalogFor("u-1", "ws-1")).resolves.toEqual({ categories: [], modules: [{ ...SALES, plugin: CORE }] })
        expect(members.require).toHaveBeenCalledWith("u-1", "ws-1")
        expect(enterprise.openOf).toHaveBeenCalledWith("ws-1", [SALES, DESK])
    })

    it("shows a caller who names no workspace the public modules, with no membership asked", async () => {
        const { access, enterprise, members } = await build()
        enterprise.openOf.mockResolvedValue([SALES])
        await expect(access.catalogFor("u-1", null)).resolves.toEqual({ categories: [], modules: [{ ...SALES, plugin: CORE }] })
        expect(members.require).not.toHaveBeenCalled()
        expect(enterprise.openOf).toHaveBeenCalledWith(null, [SALES, DESK])
    })

    it("refuses the catalogue of a workspace the caller is no member of", async () => {
        const { access, enterprise, members } = await build()
        members.require.mockRejectedValue(new Error("not a member"))
        await expect(access.catalogFor("u-1", "ws-1")).rejects.toThrow("not a member")
        expect(enterprise.openOf).not.toHaveBeenCalled()
    })

    it("reads a public module for anyone, with no workspace read", async () => {
        const { access, enterprise, members } = await build()
        await expect(access.findFor("u-1", "sales", null)).resolves.toEqual({ ...SALES, plugin: CORE })
        expect(members.require).not.toHaveBeenCalled()
        expect(enterprise.opens).not.toHaveBeenCalled()
    })

    it("reads a private module only for a member of a workspace it is open to; else the not-found of an unknown key", async () => {
        const { access, enterprise, members } = await build()
        await expect(access.findFor("u-1", FIXTURE_MODULE, null)).rejects.toMatchObject({
            code: ModulesErrorCode.NotFound,
            params: { key: FIXTURE_MODULE },
        })
        enterprise.opens.mockResolvedValue(false)
        await expect(access.findFor("u-1", FIXTURE_MODULE, "ws-1")).rejects.toMatchObject({ code: ModulesErrorCode.NotFound })
        expect(members.require).toHaveBeenCalledWith("u-1", "ws-1")
        enterprise.opens.mockResolvedValue(true)
        await expect(access.findFor("u-1", FIXTURE_MODULE, "ws-1")).resolves.toEqual({
            ...DESK,
            plugin: { key: "fixture", label: { vi: "Thu", en: "Fixture" } },
        })
        await expect(access.requireOpen("ws-1", FIXTURE_MODULE)).resolves.toBeUndefined()
    })
})
