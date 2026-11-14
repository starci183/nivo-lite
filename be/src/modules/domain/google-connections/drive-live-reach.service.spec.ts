import { mock } from "@starci/jest-preset"
import { DocumentsError, DocumentsErrorCode, type DocumentsPort, type DriveAccess } from "@modules/integrations/documents"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { DriveGrantService } from "./drive-grant.service"
import { DriveLiveReachService } from "./drive-live-reach.service"

const CONNECTION = connectionRecord({ id: "drv-live", workspaceId: "ws-1", provider: "google_drive" })
const LISTING = { name: "Folder", files: [], truncated: false }

const build = () => {
    const access = mock<DriveAccess>()
    access.state.mockResolvedValue("connected")
    access.withToken.mockImplementation((use) => use("token-1"))
    const grants = mock<DriveGrantService>()
    grants.forWorkspace.mockReturnValue(access)
    const documents = mock<DocumentsPort>()
    documents.listDriveFolder.mockResolvedValue(LISTING)
    documents.readDriveFile.mockResolvedValue({ name: "A", text: "text" })
    return { live: new DriveLiveReachService(grants, documents), grants, access, documents }
}

describe("DriveLiveReachService", () => {
    it("is the provider google_drive", () => {
        expect(build().live.provider).toBe("google_drive")
    })

    it("answers where the workspace grant stands", async () => {
        const { live, grants } = build()

        await expect(live.grant(CONNECTION)).resolves.toBe("connected")
        expect(grants.forWorkspace).toHaveBeenCalledWith("ws-1")
    })

    it("lists a folder and reads a file with the token the grant hands out", async () => {
        const { live, documents } = build()

        await expect(live.listFolder(CONNECTION, "folder-1")).resolves.toBe(LISTING)
        await expect(live.readFile(CONNECTION, "file-1")).resolves.toEqual({ name: "A", text: "text" })

        expect(documents.listDriveFolder).toHaveBeenCalledWith("token-1", "folder-1")
        expect(documents.readDriveFile).toHaveBeenCalledWith("token-1", "file-1")
    })

    it("lets the integration's own refusal travel up unchanged: the family the sandbox twin throws", async () => {
        const { live, documents, access } = build()
        const refusal = new DocumentsError({ code: DocumentsErrorCode.DriveNoAccess })
        documents.readDriveFile.mockRejectedValue(refusal)
        access.withToken.mockRejectedValue(new DocumentsError({ code: DocumentsErrorCode.DriveGrantMissing }))

        await expect(live.listFolder(CONNECTION, "f")).rejects.toMatchObject({ code: DocumentsErrorCode.DriveGrantMissing })
        access.withToken.mockImplementation((use) => use("token-1"))
        await expect(live.readFile(CONNECTION, "f")).rejects.toBe(refusal)
    })
})
