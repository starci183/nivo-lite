import { mock } from "@starci/jest-preset"
import type { WorkspaceSettingsAccessService } from "@modules/domain/workspace-settings"
import type { Logger } from "@modules/platform/logging"
import { ReadWorkspaceSettingsHandler } from "./read-workspace-settings.handler"
import { ReadWorkspaceSettingsQuery } from "./read-workspace-settings.query"
import { RequestWorkspaceLogoUploadCommand } from "./request-workspace-logo-upload.command"
import { RequestWorkspaceLogoUploadHandler } from "./request-workspace-logo-upload.handler"
import { UpdateWorkspaceSettingsCommand } from "./update-workspace-settings.command"
import { UpdateWorkspaceSettingsHandler } from "./update-workspace-settings.handler"

const PRINCIPAL = { id: "user-1", role: "authenticated" } as const
const SETTINGS = { name: "Spa Hoa Mai", timeZone: "Asia/Bangkok", logoUrl: null }

const door = (): ReturnType<typeof mock<WorkspaceSettingsAccessService>> => mock<WorkspaceSettingsAccessService>()

describe("the workspace settings handlers", () => {
    it("read: asks the door for the caller's workspace", async () => {
        const settings = door()
        settings.read.mockResolvedValue(SETTINGS)
        const handler = new ReadWorkspaceSettingsHandler(mock<Logger>(), settings)

        const answer = await handler.execute(
            new ReadWorkspaceSettingsQuery({ request: { workspaceId: "ws-1" }, principal: PRINCIPAL }),
        )

        expect(answer).toEqual(SETTINGS)
        expect(settings.read).toHaveBeenCalledWith("user-1", "ws-1")
    })

    it("update: hands the caller, the workspace and the edit to the door and answers the settings it saved", async () => {
        const settings = door()
        settings.change.mockResolvedValue(SETTINGS)
        const handler = new UpdateWorkspaceSettingsHandler(mock<Logger>(), settings)

        const answer = await handler.execute(
            new UpdateWorkspaceSettingsCommand({
                request: { workspaceId: "ws-1", edit: { name: "Spa Hoa Mai", logoPath: null } },
                principal: PRINCIPAL,
            }),
        )

        expect(answer).toEqual(SETTINGS)
        expect(settings.change).toHaveBeenCalledWith("user-1", "ws-1", { name: "Spa Hoa Mai", logoPath: null })
    })

    it("logo upload: asks the door for an upload address for the file the browser describes", async () => {
        const settings = door()
        const upload = { path: "workspaces/x.png", token: "t", signedUrl: "https://s", publicUrl: "https://p" }
        settings.requestLogoUpload.mockResolvedValue(upload)
        const handler = new RequestWorkspaceLogoUploadHandler(mock<Logger>(), settings)

        const answer = await handler.execute(
            new RequestWorkspaceLogoUploadCommand({
                request: { workspaceId: "ws-1", contentType: "image/png", sizeBytes: 4096 },
                principal: PRINCIPAL,
            }),
        )

        expect(answer).toBe(upload)
        expect(settings.requestLogoUpload).toHaveBeenCalledWith("user-1", "ws-1", {
            contentType: "image/png",
            sizeBytes: 4096,
        })
    })
})
