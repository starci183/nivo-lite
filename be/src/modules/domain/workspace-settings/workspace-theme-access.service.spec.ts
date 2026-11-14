import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { WorkspaceSettingsService } from "./workspace-settings.service"
import { WorkspaceThemeAccessService } from "./workspace-theme-access.service"

const build = async () => {
    const settings = mock<WorkspaceSettingsService>()
    settings.setTheme.mockResolvedValue(null)
    const members = mock<WorkspaceMembersService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspaceThemeAccessService,
            { provide: WorkspaceSettingsService, useValue: settings },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { access: moduleRef.get(WorkspaceThemeAccessService), settings, members }
}

describe("WorkspaceThemeAccessService", () => {
    it("updateTheme proves an owner or manager, then saves every member of the request but its workspaceId as the theme", async () => {
        const { access, settings, members } = await build()

        const request = { workspaceId: "ws-1", hue: 200, radius: "md" }

        await access.updateTheme("user-1", request)

        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
        expect(settings.setTheme).toHaveBeenCalledWith("ws-1", { hue: 200, radius: "md" })
    })

    it("resetTheme saves the null theme (the NIVO default) after the same seat check and answers true", async () => {
        const { access, settings, members } = await build()

        await expect(access.resetTheme("user-1", "ws-1")).resolves.toBe(true)

        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
        expect(settings.setTheme).toHaveBeenCalledWith("ws-1", null)
    })

    it("refuses a member who is not an owner or manager before anything is saved", async () => {
        const { access, settings, members } = await build()
        members.require.mockRejectedValue(new Error("forbidden"))

        await expect(access.resetTheme("user-2", "ws-1")).rejects.toThrow("forbidden")
        expect(settings.setTheme).not.toHaveBeenCalled()
    })
})
