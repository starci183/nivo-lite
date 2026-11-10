import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentDeletionPauseService } from "@modules/domain/agents"
import { WorkspaceLobbyService } from "@modules/domain/workspaces"
import { MyInvitesService } from "./my-invites.service"
import { WorkspaceDeletionService } from "./workspace-deletion.service"

const build = async () => {
    const lobby = mock<WorkspaceLobbyService>()
    const agents = mock<AgentDeletionPauseService>()
    const invites = mock<MyInvitesService>()
    lobby.remove.mockResolvedValue(undefined)
    lobby.restore.mockResolvedValue(undefined)
    agents.pauseAll.mockResolvedValue(2)
    agents.resumeAll.mockResolvedValue(2)
    invites.revokeAllOf.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspaceDeletionService,
            { provide: WorkspaceLobbyService, useValue: lobby },
            { provide: AgentDeletionPauseService, useValue: agents },
            { provide: MyInvitesService, useValue: invites },
        ],
    }).compile()
    return { service: moduleRef.get(WorkspaceDeletionService), lobby, agents, invites }
}

describe("WorkspaceDeletionService > remove", () => {
    it("deletes the workspace, pauses its agents, then revokes its pending invitations", async () => {
        const { service, lobby, agents, invites } = await build()

        await service.remove("user-1", "ws-1", "Spa Hoa Mai")

        expect(lobby.remove).toHaveBeenCalledWith("user-1", "ws-1", "Spa Hoa Mai")
        expect(agents.pauseAll).toHaveBeenCalledWith("ws-1")
        expect(invites.revokeAllOf).toHaveBeenCalledWith("ws-1")
    })

    it("pauses and revokes nothing when the deletion is refused", async () => {
        const { service, lobby, agents, invites } = await build()
        const refusal = new Error("confirm mismatch")
        lobby.remove.mockRejectedValue(refusal)

        await expect(service.remove("user-1", "ws-1", "Spa")).rejects.toBe(refusal)
        expect(agents.pauseAll).not.toHaveBeenCalled()
        expect(invites.revokeAllOf).not.toHaveBeenCalled()
    })
})

describe("WorkspaceDeletionService > restore", () => {
    it("restores the workspace, then resumes the agents the deletion paused", async () => {
        const { service, lobby, agents } = await build()

        await service.restore("user-1", "ws-1")

        expect(lobby.restore).toHaveBeenCalledWith("user-1", "ws-1")
        expect(agents.resumeAll).toHaveBeenCalledWith("ws-1")
    })

    it("resumes nothing when the restore is refused", async () => {
        const { service, lobby, agents } = await build()
        const refusal = new Error("restore expired")
        lobby.restore.mockRejectedValue(refusal)

        await expect(service.restore("user-1", "ws-1")).rejects.toBe(refusal)
        expect(agents.resumeAll).not.toHaveBeenCalled()
    })
})
