import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkspaceEnterpriseService } from "@modules/domain/workspaces"
import type { Principal } from "@modules/platform/cqrs"
import { AdminAccessService } from "./admin-access.service"
import { AdminEnterpriseService } from "./admin-enterprise.service"
import { PlatformAdminError, PlatformAdminErrorCode } from "./errors/platform-admin.error"

const PRINCIPAL: Principal = { id: "admin-1", email: "admin@nivo.vn", role: "authenticated" }
const ADMIN = { userId: "admin-1", email: "admin@nivo.vn" }

const build = async () => {
    const access = mock<AdminAccessService>()
    access.requireAdmin.mockReturnValue(ADMIN)
    const enterprise = mock<WorkspaceEnterpriseService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AdminEnterpriseService,
            { provide: AdminAccessService, useValue: access },
            { provide: WorkspaceEnterpriseService, useValue: enterprise },
        ],
    }).compile()
    return { service: moduleRef.get(AdminEnterpriseService), access, enterprise }
}

describe("AdminEnterpriseService", () => {
    it("sets the enterprise identifier of a workspace and audits what it was and is", async () => {
        const { service, access, enterprise } = await build()
        enterprise.set.mockResolvedValue({ from: null, to: "nivo-web" })
        await expect(service.setEnterpriseKey(PRINCIPAL, "ws-1", "nivo-web")).resolves.toEqual({ enterpriseKey: "nivo-web" })
        expect(enterprise.set).toHaveBeenCalledWith("ws-1", "nivo-web")
        expect(access.audit).toHaveBeenCalledWith(ADMIN, "workspace.set_enterprise_key", "ws-1", {
            from: null,
            to: "nivo-web",
        })
    })

    it("clears it with null", async () => {
        const { service, enterprise } = await build()
        enterprise.set.mockResolvedValue({ from: "nivo-web", to: null })
        await expect(service.setEnterpriseKey(PRINCIPAL, "ws-1", null)).resolves.toEqual({ enterpriseKey: null })
        expect(enterprise.set).toHaveBeenCalledWith("ws-1", null)
    })

    it("refuses a caller who is no platform admin before anything is changed", async () => {
        const { service, access, enterprise } = await build()
        access.requireAdmin.mockImplementation(() => {
            throw new PlatformAdminError({ code: PlatformAdminErrorCode.NotFound })
        })
        await expect(service.setEnterpriseKey(PRINCIPAL, "ws-1", "nivo-web")).rejects.toMatchObject({
            code: PlatformAdminErrorCode.NotFound,
        })
        expect(enterprise.set).not.toHaveBeenCalled()
        expect(access.audit).not.toHaveBeenCalled()
    })

    it("audits nothing when the write is refused", async () => {
        const { service, access, enterprise } = await build()
        enterprise.set.mockRejectedValue(new Error("taken"))
        await expect(service.setEnterpriseKey(PRINCIPAL, "ws-1", "nivo-web")).rejects.toThrow("taken")
        expect(access.audit).not.toHaveBeenCalled()
    })
})
