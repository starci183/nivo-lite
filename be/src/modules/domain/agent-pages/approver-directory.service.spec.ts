import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { ApproverDirectoryService } from "./approver-directory.service"

const build = async () => {
    const members = mock<WorkspaceMembersService>()
    const container = await Test.createTestingModule({
        providers: [ApproverDirectoryService, { provide: WorkspaceMembersService, useValue: members }],
    }).compile()
    return { service: container.get(ApproverDirectoryService), members }
}

describe("ApproverDirectoryService.list", () => {
    it("answers no one to an owner or manager of the workspace: approver groups are gone with the authority rules", async () => {
        const { service, members } = await build()

        await expect(service.list("user-1", "ws-1")).resolves.toEqual([])
        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
    })

    it("refuses a caller who is not an owner or manager", async () => {
        const { service, members } = await build()
        members.require.mockRejectedValue(new Error("not a manager"))

        await expect(service.list("user-1", "ws-1")).rejects.toThrow("not a manager")
    })
})
