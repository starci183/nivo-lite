import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { WorkspaceSettingsAccessService } from "./workspace-settings-access.service"
import type { WorkspaceLogos } from "./workspace-settings.contracts"
import { WORKSPACE_SETTINGS_LOGOS } from "./workspace-settings.decorators"
import { WorkspaceSettingsService } from "./workspace-settings.service"

const SETTINGS = { name: "Spa Hoa Mai", timeZone: "Asia/Bangkok", logoUrl: null }
const ADDRESS = "https://files.example.test/avatars_public/workspaces/0b0a7a3a-1c1d-4e1f-8a2b-3c4d5e6f7a8b.png"
const PATH = "workspaces/0b0a7a3a-1c1d-4e1f-8a2b-3c4d5e6f7a8b.png"

const build = async () => {
    const settings = mock<WorkspaceSettingsService>()
    settings.get.mockResolvedValue(SETTINGS)
    settings.update.mockResolvedValue(SETTINGS)
    const members = mock<WorkspaceMembersService>()
    const avatars = mock<WorkspaceLogos>()
    avatars.workspaceLogoAddressOf.mockReturnValue(ADDRESS)
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspaceSettingsAccessService,
            { provide: WorkspaceSettingsService, useValue: settings },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: WORKSPACE_SETTINGS_LOGOS, useValue: avatars },
        ],
    }).compile()
    return { service: moduleRef.get(WorkspaceSettingsAccessService), settings, members, avatars }
}

describe("WorkspaceSettingsAccessService", () => {
    it("lets any member read the settings", async () => {
        const { service, members, settings } = await build()
        await expect(service.read("u1", "ws-1")).resolves.toEqual(SETTINGS)
        expect(members.require).toHaveBeenCalledWith("u1", "ws-1")
        expect(settings.get).toHaveBeenCalledWith("ws-1")
    })

    it("does not read for a caller the members service refuses", async () => {
        const { service, members, settings } = await build()
        members.require.mockRejectedValue(new Error("not a member"))
        await expect(service.read("u1", "ws-1")).rejects.toThrow("not a member")
        expect(settings.get).not.toHaveBeenCalled()
    })

    it("changes the settings for an owner or a manager only, and turns the logo path into the storage address", async () => {
        const { service, members, settings, avatars } = await build()
        await service.change("u1", "ws-1", { name: "Spa Hoa Mai", timeZone: "Asia/Bangkok", logoPath: PATH })
        expect(members.require).toHaveBeenCalledWith("u1", "ws-1", ["owner", "manager"])
        expect(avatars.workspaceLogoAddressOf).toHaveBeenCalledWith(PATH)
        expect(settings.update).toHaveBeenCalledWith("ws-1", {
            name: "Spa Hoa Mai",
            timeZone: "Asia/Bangkok",
            logoUrl: ADDRESS,
        })
    })

    it("removes the logo with a null path and leaves it alone when no path is sent", async () => {
        const { service, settings } = await build()
        await service.change("u1", "ws-1", { logoPath: null })
        expect(settings.update).toHaveBeenLastCalledWith("ws-1", { logoUrl: null })
        await service.change("u1", "ws-1", { name: "A" })
        expect(settings.update).toHaveBeenLastCalledWith("ws-1", { name: "A" })
    })

    it("leaves the name and the time zone alone when the edit carries them as null or undefined", async () => {
        const { service, settings } = await build()
        await service.change("u1", "ws-1", { name: null, timeZone: undefined, logoPath: undefined })
        expect(settings.update).toHaveBeenLastCalledWith("ws-1", {})
        await service.change("u1", "ws-1", { name: null, timeZone: "Asia/Ho_Chi_Minh" })
        expect(settings.update).toHaveBeenLastCalledWith("ws-1", { timeZone: "Asia/Ho_Chi_Minh" })
    })

    it("writes nothing for a caller the members service refuses", async () => {
        const { service, members, settings } = await build()
        members.require.mockRejectedValue(new Error("role forbidden"))
        await expect(service.change("u1", "ws-1", { name: "A" })).rejects.toThrow("role forbidden")
        expect(settings.update).not.toHaveBeenCalled()
    })

    it("asks the avatars service for the logo upload address, which holds the manager check", async () => {
        const { service, avatars } = await build()
        const upload = { path: PATH, token: "t", signedUrl: "https://s", publicUrl: ADDRESS }
        avatars.requestWorkspaceUpload.mockResolvedValue(upload)
        const file = { contentType: "image/png", sizeBytes: 10 }
        await expect(service.requestLogoUpload("u1", "ws-1", file)).resolves.toBe(upload)
        expect(avatars.requestWorkspaceUpload).toHaveBeenCalledWith("u1", "ws-1", file)
    })
})
