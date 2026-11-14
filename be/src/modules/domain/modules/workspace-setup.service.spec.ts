import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkspacesService } from "@modules/domain/workspaces"
import { WorkspaceSetupService } from "./workspace-setup.service"

const build = async () => {
    const workspaces = mock<WorkspacesService>()
    workspaces.createFree.mockResolvedValue({ id: "ws-1" })
    workspaces.startFirst.mockResolvedValue({ id: "ws-1" })
    const moduleRef = await Test.createTestingModule({
        providers: [WorkspaceSetupService, { provide: WorkspacesService, useValue: workspaces }],
    }).compile()
    return { service: moduleRef.get(WorkspaceSetupService), workspaces }
}

describe("WorkspaceSetupService", () => {
    it("creates the workspace and lays down no authority rule", async () => {
        const { service, workspaces } = await build()

        await expect(service.createFree("user-1", "Shop")).resolves.toEqual({ id: "ws-1" })
        expect(workspaces.createFree).toHaveBeenCalledWith("user-1", "Shop", null)
    })

    it("starts the first workspace of a person, and answers none when none was made", async () => {
        const { service, workspaces } = await build()

        await expect(service.startFirst("user-1")).resolves.toEqual({ id: "ws-1" })
        expect(workspaces.startFirst).toHaveBeenCalledWith("user-1")
        workspaces.startFirst.mockResolvedValue({ id: null })
        await expect(service.startFirst("user-1")).resolves.toEqual({ id: null })
    })
})
