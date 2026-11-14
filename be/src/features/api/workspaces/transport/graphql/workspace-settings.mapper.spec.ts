import { toRequestWorkspaceLogoUploadRequest, toUpdateWorkspaceSettingsRequest } from "./workspace-settings.mapper"

describe("toUpdateWorkspaceSettingsRequest", () => {
    it("leaves out the members the input does not carry, so they stay as they are", () => {
        expect(toUpdateWorkspaceSettingsRequest("ws-1", {})).toEqual({ workspaceId: "ws-1", edit: {} })
        expect(toUpdateWorkspaceSettingsRequest("ws-1", { name: "Spa", timeZone: "Asia/Tokyo" })).toEqual({
            workspaceId: "ws-1",
            edit: { name: "Spa", timeZone: "Asia/Tokyo" },
        })
    })

    it("keeps a null logo path (remove the logo) apart from an absent one (keep it)", () => {
        expect(toUpdateWorkspaceSettingsRequest("ws-1", { logoPath: null }).edit).toEqual({ logoPath: null })
        expect(toUpdateWorkspaceSettingsRequest("ws-1", { logoPath: "workspaces/x.png" }).edit).toEqual({
            logoPath: "workspaces/x.png",
        })
        expect(toUpdateWorkspaceSettingsRequest("ws-1", {}).edit).not.toHaveProperty("logoPath")
    })
})

describe("toRequestWorkspaceLogoUploadRequest", () => {
    it("names the workspace beside the file", () => {
        expect(toRequestWorkspaceLogoUploadRequest("ws-1", { contentType: "image/png", sizeBytes: 10 })).toEqual({
            workspaceId: "ws-1",
            contentType: "image/png",
            sizeBytes: 10,
        })
    })
})
