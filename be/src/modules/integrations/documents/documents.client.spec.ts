import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import type { MockOf } from "@starci/jest-preset"
import type { DocumentReaders, DriveAccess } from "./documents.contracts"
import { DOCUMENTS_OPTIONS } from "./documents.decorators"
import type { DocumentsOptions } from "./documents.options"
import { DocumentsClient } from "./documents.client"
import { DriveApiClient } from "./drive-api.client"
import { DriveFolderClient } from "./drive-folder.client"
import { DocumentsError, DocumentsErrorCode } from "./errors/documents.error"
import { PublicLinkClient } from "./public-link.client"

const optionsOf = builder<DocumentsOptions>({
    driveBase: "https://drive.test/v3",
    oauthBase: null,
    google: null,
    readers: mock<DocumentReaders>(),
})

const ID = "1AbCdEfGhIjKlMnOp"

const build = async (options: DocumentsOptions = optionsOf()) => {
    const links = mock<PublicLinkClient>()
    const drive = mock<DriveApiClient>()
    const folders = mock<DriveFolderClient>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            DocumentsClient,
            { provide: DOCUMENTS_OPTIONS, useValue: options },
            { provide: PublicLinkClient, useValue: links },
            { provide: DriveApiClient, useValue: drive },
            { provide: DriveFolderClient, useValue: folders },
        ],
    }).compile()
    return { client: moduleRef.get(DocumentsClient), links, drive, folders }
}

const accessOf = (state: "none" | "connected" | "lost"): MockOf<DriveAccess> => {
    const access = mock<DriveAccess>()
    access.state.mockResolvedValue(state)
    access.withToken.mockImplementation((fn) => fn("token-1"))
    return access
}

describe("DocumentsClient", () => {
    describe("readLink", () => {
        it("reads a public address", async () => {
            const { client, links } = await build()
            links.read.mockResolvedValue({ text: "page", title: "Page" })

            await expect(client.readLink("https://shop.test/menu", null)).resolves.toEqual({
                text: "page",
                title: "Page",
            })

            expect(links.read).toHaveBeenCalledWith({ kind: "web", fetchUrl: "https://shop.test/menu" })
        })

        it("refuses a text that is not a link", async () => {
            const { client } = await build()

            await expect(client.readLink("not a link", null)).rejects.toMatchObject({
                code: DocumentsErrorCode.LinkInvalid,
            })
        })

        it.each([
            ["connected", DocumentsErrorCode.FolderUnsupported],
            ["none", DocumentsErrorCode.DriveGrantMissing],
            ["lost", DocumentsErrorCode.DriveGrantMissing],
        ] as const)("refuses a Drive folder with the grant %s", async (state, code) => {
            const { client } = await build()

            await expect(
                client.readLink(`https://drive.google.com/drive/folders/${ID}`, accessOf(state)),
            ).rejects.toMatchObject({ code })
        })

        it("asks for the grant when a Drive folder arrives from an API key", async () => {
            const { client } = await build()

            await expect(client.readLink(`https://drive.google.com/drive/folders/${ID}`, null)).rejects.toMatchObject({
                code: DocumentsErrorCode.DriveGrantMissing,
            })
        })

        it("reads a Google file that is not public with the Drive access of the workspace", async () => {
            const { client, links, drive } = await build()
            links.read.mockRejectedValue(new DocumentsError({ code: DocumentsErrorCode.NotPublic }))
            drive.readFile.mockResolvedValue({ name: "n".repeat(200), text: "private words" })

            const read = await client.readLink(`https://docs.google.com/document/d/${ID}/edit`, accessOf("connected"))

            expect(read.text).toBe("private words")
            expect(read.title).toHaveLength(160)
            expect(drive.readFile).toHaveBeenCalledWith("token-1", ID)
        })

        it("asks for the grant when the workspace never gave Drive access", async () => {
            const { client, links } = await build()
            links.read.mockRejectedValue(new DocumentsError({ code: DocumentsErrorCode.NotPublic }))

            await expect(
                client.readLink(`https://docs.google.com/document/d/${ID}/edit`, accessOf("none")),
            ).rejects.toMatchObject({ code: DocumentsErrorCode.DriveGrantMissing })
        })

        it("lets the Drive access of the workspace report a lost grant", async () => {
            const { client, links } = await build()
            links.read.mockRejectedValue(new DocumentsError({ code: DocumentsErrorCode.NotPublic }))
            const access = accessOf("lost")
            const lost = new DocumentsError({ code: DocumentsErrorCode.DriveGrantLost })
            access.withToken.mockRejectedValue(lost)

            await expect(client.readLink(`https://docs.google.com/document/d/${ID}/edit`, access)).rejects.toBe(lost)
        })

        it.each([
            ["an API key", null, new DocumentsError({ code: DocumentsErrorCode.NotPublic })],
            ["a plain page", accessOf("connected"), new DocumentsError({ code: DocumentsErrorCode.NotPublic })],
            ["another failure", accessOf("connected"), new DocumentsError({ code: DocumentsErrorCode.Unavailable })],
            ["a failure that is not a documents error", accessOf("connected"), new Error("boom")],
        ])("rethrows the failure for %s", async (name, access, failure) => {
            const { client, links } = await build()
            links.read.mockRejectedValue(failure)
            const raw =
                name === "a plain page" ? "https://shop.test/menu" : `https://docs.google.com/document/d/${ID}/edit`

            await expect(client.readLink(raw, access)).rejects.toBe(failure)
        })
    })

    describe("driveFolderOf", () => {
        it("answers the folder id of a Drive folder address, and null for anything else", async () => {
            const { client } = await build()

            expect(client.driveFolderOf(`https://drive.google.com/drive/folders/${ID}`)).toBe(ID)
            expect(client.driveFolderOf("https://drive.google.com/drive/my-drive")).toBeNull()
            expect(client.driveFolderOf("https://shop.test/menu")).toBeNull()
            expect(client.driveFolderOf("not a link")).toBeNull()
        })
    })

    describe("canReadFileName", () => {
        it("accepts a readable extension and a name without one, and refuses another extension", async () => {
            const { client } = await build()

            expect(client.canReadFileName("menu.pdf")).toBe(true)
            expect(client.canReadFileName("menu")).toBe(true)
            expect(client.canReadFileName("photo.png")).toBe(false)
        })
    })

    describe("readFile", () => {
        it("reads bytes by the kind the name gives", async () => {
            const { client } = await build()

            await expect(client.readFile("notes.txt", new TextEncoder().encode("plain"), "")).resolves.toBe("plain")
        })

        it("sniffs the kind when the name has no extension", async () => {
            const { client } = await build()

            await expect(client.readFile("notes", new TextEncoder().encode("plain"), "text/plain")).resolves.toBe(
                "plain",
            )
        })

        it.each([
            ["image/png", "image/png"],
            ["", "unknown"],
        ])("refuses bytes of a kind it cannot read (%s)", async (type, named) => {
            const { client } = await build()

            await expect(client.readFile("blob", new Uint8Array(), type)).rejects.toMatchObject({
                code: DocumentsErrorCode.TypeUnsupported,
                params: { type: named },
            })
        })
    })

    describe("Drive", () => {
        it("hands a Drive file, a folder and a token refresh to the Drive client", async () => {
            const { client, drive, folders } = await build()
            drive.readFile.mockResolvedValue({ name: "f", text: "t" })
            folders.listFolder.mockResolvedValue({ name: "d", files: [], truncated: false })
            drive.refreshAccessToken.mockResolvedValue({ accessToken: "a", refreshToken: null, expiresInSeconds: 3600 })

            await expect(client.readDriveFile("token", ID)).resolves.toEqual({ name: "f", text: "t" })
            await expect(client.listDriveFolder("token", ID)).resolves.toEqual({
                name: "d",
                files: [],
                truncated: false,
            })
            await expect(client.refreshGoogleAccessToken("refresh")).resolves.toMatchObject({ accessToken: "a" })

            expect(drive.readFile).toHaveBeenCalledWith("token", ID)
            expect(folders.listFolder).toHaveBeenCalledWith("token", ID)
            expect(drive.refreshAccessToken).toHaveBeenCalledWith("refresh")
        })
    })
})
