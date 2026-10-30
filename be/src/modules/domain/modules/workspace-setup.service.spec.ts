import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AuthorityService } from "@modules/domain/authority"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { WorkspacesService } from "@modules/domain/workspaces"
import { MODULE_CATEGORIES } from "./categories.contracts"
import { MODULE_CATALOG } from "./modules.catalog.contracts"
import { ModulesService } from "./modules.service"
import { defaultRulesOf } from "./policies/instance.policy"
import { WorkspaceSetupService } from "./workspace-setup.service"

const STABLE = MODULE_CATALOG.filter((module) => module.status === "stable")

const build = async (created: boolean) => {
    const workspaces = mock<WorkspacesService>()
    workspaces.createFree.mockResolvedValue({ id: "ws-1" })
    const authority = mock<AuthorityService>()
    authority.ensureSheet.mockResolvedValue(created)
    const rules = mock<AuthorityRulesService>()
    rules.seedDefaults.mockResolvedValue(undefined)
    const catalog = mock<ModulesService>()
    catalog.catalog.mockResolvedValue({ categories: MODULE_CATEGORIES, modules: MODULE_CATALOG })
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspaceSetupService,
            { provide: WorkspacesService, useValue: workspaces },
            { provide: AuthorityService, useValue: authority },
            { provide: AuthorityRulesService, useValue: rules },
            { provide: ModulesService, useValue: catalog },
        ],
    }).compile()
    return { service: moduleRef.get(WorkspaceSetupService), workspaces, authority, rules }
}

describe("WorkspaceSetupService", () => {
    it("creates the workspace, then its authority sheet and the default rules of every stable module", async () => {
        const { service, workspaces, authority, rules } = await build(true)

        await expect(service.createFree("user-1", "Shop")).resolves.toEqual({ id: "ws-1" })

        expect(workspaces.createFree).toHaveBeenCalledWith("user-1", "Shop", null)
        expect(authority.ensureSheet).toHaveBeenCalledWith("ws-1")
        expect(rules.seedDefaults).toHaveBeenCalledTimes(STABLE.length)
        STABLE.forEach((module) => {
            expect(rules.seedDefaults).toHaveBeenCalledWith("ws-1", module.key, defaultRulesOf(module))
        })
    })

    it("grants no rule to a workspace that already has its sheet", async () => {
        const { service, rules } = await build(false)

        await expect(service.ensureGovernance("ws-1")).resolves.toBe(false)

        expect(rules.seedDefaults).not.toHaveBeenCalled()
    })

    it("never grants the rules of an early module", async () => {
        const { service, rules } = await build(true)

        await expect(service.ensureGovernance("ws-1")).resolves.toBe(true)

        const granted = rules.seedDefaults.mock.calls.map(([, key]) => key)
        MODULE_CATALOG.filter((module) => module.status === "early").forEach((module) => {
            expect(granted).not.toContain(module.key)
        })
    })
})
