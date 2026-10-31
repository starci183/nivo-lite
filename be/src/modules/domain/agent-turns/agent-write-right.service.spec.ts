import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { PresentedRole, WorkspaceMembersService } from "@modules/domain/workspace-members"
import { AgentWriteRightService } from "./agent-write-right.service"

const build = async (role: PresentedRole) => {
    const members = mock<WorkspaceMembersService>({ roleOf: jest.fn(() => Promise.resolve(role)) })
    const moduleRef = await Test.createTestingModule({
        providers: [AgentWriteRightService, { provide: WorkspaceMembersService, useValue: members }],
    }).compile()
    return { right: moduleRef.get(AgentWriteRightService), members }
}

describe("AgentWriteRightService", () => {
    it.each([PresentedRole.Owner, PresentedRole.Manager])("lets a tag written by a %s write", async (role) => {
        const { right, members } = await build(role)

        await expect(right.mayWrite("tag", "user-1", "ws-1")).resolves.toBe(true)
        expect(members.roleOf).toHaveBeenCalledWith("user-1", "ws-1")
    })

    it("refuses a tag written by staff", async () => {
        const { right } = await build(PresentedRole.Staff)

        await expect(right.mayWrite("tag", "user-1", "ws-1")).resolves.toBe(false)
    })

    it.each(["customer", "internal", "schedule"] as const)(
        "refuses a %s turn without asking for a role",
        async (source) => {
            const { right, members } = await build(PresentedRole.Owner)

            await expect(right.mayWrite(source, "user-1", "ws-1")).resolves.toBe(false)
            expect(members.roleOf).not.toHaveBeenCalled()
        },
    )

    it("refuses a tag with no author", async () => {
        const { right, members } = await build(PresentedRole.Owner)

        await expect(right.mayWrite("tag", null, "ws-1")).resolves.toBe(false)
        expect(members.roleOf).not.toHaveBeenCalled()
    })
})
