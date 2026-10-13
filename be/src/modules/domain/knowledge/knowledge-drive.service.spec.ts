import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { DOCUMENTS, DocumentsError, DocumentsErrorCode } from "@modules/integrations/documents"
import type { DocumentsPort, DriveAccess } from "@modules/integrations/documents"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { KnowledgeDriveService } from "./knowledge-drive.service"
import { KnowledgeLogEvent } from "./knowledge.log-events"
import { DRIVE_ACCESS_SOURCE } from "./knowledge.decorators"
import type { DriveAccessSource } from "./knowledge.contracts"

const WS = "11111111-1111-4111-8111-111111111111"
const TOKEN = "ya29.a0AfH6SMB-xyz_123abcdefghij"
const LISTING = { name: "Menus", files: [], truncated: false }
const FILE = { id: "a", name: "menu.pdf", mimeType: "application/pdf", size: null, modifiedTime: null, path: "" }

const build = async (access: DriveAccess | null = null) => {
    const documents = mock<DocumentsPort>()
    const members = mock<WorkspaceMembersService>()
    const logger = mock<Logger>()
    const driveAccess = mock<DriveAccessSource>()
    driveAccess.forWorkspace.mockReturnValue(access)
    const { forWorkspace } = driveAccess
    const moduleRef = await Test.createTestingModule({
        providers: [
            KnowledgeDriveService,
            { provide: DRIVE_ACCESS_SOURCE, useValue: driveAccess },
            { provide: DOCUMENTS, useValue: documents },
            { provide: LOGGER, useValue: logger },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(KnowledgeDriveService), documents, members, logger, forWorkspace }
}

describe("KnowledgeDriveService", () => {
    describe("listLinkedFolder", () => {
        it("lists the folder with the token of the Drive access the workspace gave", async () => {
            const access = mock<DriveAccess>()
            access.withToken.mockImplementation((use) => use("drive-token"))
            const { service, documents, members, forWorkspace } = await build(access)
            documents.driveFolderOf.mockReturnValue("f1")
            documents.listDriveFolder.mockResolvedValue(LISTING)

            await expect(service.listLinkedFolder("u1", WS, "https://drive.google.com/drive/folders/f1")).resolves.toBe(
                LISTING,
            )

            expect(members.require).toHaveBeenCalledWith("u1", WS, ["owner", "manager"])
            expect(forWorkspace).toHaveBeenCalledWith(WS)
            expect(documents.listDriveFolder).toHaveBeenCalledWith("drive-token", "f1")
        })

        it("refuses an address that is not a Drive folder", async () => {
            const { service, documents } = await build()
            documents.driveFolderOf.mockReturnValue(null)

            await expect(service.listLinkedFolder("u1", WS, "https://x.test")).rejects.toMatchObject({
                code: DocumentsErrorCode.NotFolder,
            })
        })

        it("asks the owner to give Drive access when the workspace gave none", async () => {
            const { service, documents } = await build(null)
            documents.driveFolderOf.mockReturnValue("f1")

            await expect(service.listLinkedFolder("u1", WS, "https://x.test")).rejects.toMatchObject({
                code: DocumentsErrorCode.DriveGrantMissing,
            })
        })
    })

    describe("listPickedFolder", () => {
        it("lists the folder with the token of the browser", async () => {
            const { service, documents } = await build()
            documents.listDriveFolder.mockResolvedValue({ ...LISTING, files: [FILE] })

            await expect(service.listPickedFolder("u1", WS, "f1", TOKEN)).resolves.toMatchObject({ empty: false })

            expect(documents.listDriveFolder).toHaveBeenCalledWith(TOKEN, "f1")
        })

        it("says so when the folder has no files", async () => {
            const { service, documents } = await build()
            documents.listDriveFolder.mockResolvedValue(LISTING)

            await expect(service.listPickedFolder("u1", WS, "f1", TOKEN)).resolves.toEqual({ ...LISTING, empty: true })
        })

        it("refuses a token that does not look like a Google token", async () => {
            const { service, documents } = await build()

            await expect(service.listPickedFolder("u1", WS, "f1", "short")).rejects.toMatchObject({
                code: DocumentsErrorCode.TokenRejected,
            })

            expect(documents.listDriveFolder).not.toHaveBeenCalled()
        })

        it("answers an empty folder when Google refuses to list it", async () => {
            const { service, documents, logger } = await build()
            documents.listDriveFolder.mockRejectedValue(
                new DocumentsError({ code: DocumentsErrorCode.Refused, params: { status: 403 } }),
            )

            await expect(service.listPickedFolder("u1", WS, "f1", TOKEN)).resolves.toEqual({
                name: "",
                files: [],
                truncated: false,
                empty: true,
            })

            expect(logger.warn).toHaveBeenCalledWith(KnowledgeLogEvent.PickedFolderRefused, {
                workspaceId: WS,
                status: 403,
            })
        })

        it("lets any other failure through, whether it is a documents error or not", async () => {
            const { service, documents } = await build()
            const expired = new DocumentsError({ code: DocumentsErrorCode.TokenRejected })
            documents.listDriveFolder.mockRejectedValueOnce(expired).mockRejectedValueOnce(new Error("boom"))

            await expect(service.listPickedFolder("u1", WS, "f1", TOKEN)).rejects.toBe(expired)
            await expect(service.listPickedFolder("u1", WS, "f1", TOKEN)).rejects.toThrow("boom")
        })
    })
})
