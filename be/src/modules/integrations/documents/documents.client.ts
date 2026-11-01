import { Injectable } from "@nestjs/common"
import type {
    DocumentText,
    MaybeDriveAccess,
    MaybeFolderId,
    DriveFileText,
    DriveFolderListing,
    GoogleAccessToken,
    PlacedDocument,
} from "./documents.contracts"
import { InjectDocumentsOptions } from "./documents.decorators"
import type { DocumentsOptions } from "./documents.options"
import type { DocumentsPort } from "./documents.port"
import { DriveApiClient } from "./drive-api.client"
import { DriveFolderClient } from "./drive-folder.client"
import { resolveLink } from "./drive-link.policy"
import { DocumentsError, DocumentsErrorCode } from "./errors/documents.error"
import { PublicLinkClient } from "./public-link.client"
import { placedFromBytes, textFromBytes } from "./text-extraction.mapper"
import { fileTextKind, hasExtension, sniffTextKind } from "./text-kind.policy"
import type { TextKind } from "./text-kind.policy"

/** The longest title taken from a page or file name. */
const TITLE_CHARS = 160

@Injectable()
/** The documents port: it decides, for a pasted link, between the public address and the Drive access of the workspace. */
export class DocumentsClient implements DocumentsPort {
    constructor(
        @InjectDocumentsOptions() private readonly options: DocumentsOptions,
        private readonly links: PublicLinkClient,
        private readonly drive: DriveApiClient,
        private readonly folders: DriveFolderClient,
    ) {}

    /**
     * The text of a pasted link. A public address is read first; a Google file that is not public is read with the Drive access of the
     * workspace when there is one (`drive` is null for API keys, which have no Drive access).
     */
    async readLink(raw: string, drive: MaybeDriveAccess): Promise<DocumentText> {
        const target = resolveLink(raw)
        if (target.kind === "invalid") throw new DocumentsError({ code: DocumentsErrorCode.LinkInvalid })
        if (target.kind === "drive-folder") {
            const connected = drive !== null && (await drive.state()) === "connected"
            throw new DocumentsError({
                code: connected ? DocumentsErrorCode.FolderUnsupported : DocumentsErrorCode.DriveGrantMissing,
            })
        }
        try {
            return await this.links.read(target)
        } catch (cause) {
            const driveId = target.driveId
            const notPublic = cause instanceof DocumentsError && cause.code === DocumentsErrorCode.NotPublic
            if (drive === null || driveId === undefined || !notPublic) throw cause
            if ((await drive.state()) === "none")
                throw new DocumentsError({ code: DocumentsErrorCode.DriveGrantMissing, cause })
            const file = await drive.withToken((token) => this.drive.readFile(token, driveId))
            return { text: file.text, title: file.name.slice(0, TITLE_CHARS) }
        }
    }

    /** The Drive id of the folder a pasted address names, or null when the address is not a Drive folder. */
    driveFolderOf(raw: string): MaybeFolderId {
        const target = resolveLink(raw)
        return target.kind === "drive-folder" ? target.folderId : null
    }

    /** True when a file name has an extension that can be read, or no extension at all. */
    canReadFileName(name: string): boolean {
        return fileTextKind(name) !== null || !hasExtension(name)
    }

    /** The text of uploaded file bytes: the name decides the kind, else the magic bytes and the content type do. */
    async readFile(name: string, bytes: Uint8Array, contentType: string): Promise<string> {
        return textFromBytes(this.kindOf(name, bytes, contentType), bytes, this.options.readers)
    }

    /** The text of uploaded file bytes with the place of each stretch; the kind is decided as `readFile` decides it. */
    async readPlacedFile(name: string, bytes: Uint8Array, contentType: string): Promise<PlacedDocument> {
        return placedFromBytes(this.kindOf(name, bytes, contentType), bytes, this.options.readers)
    }

    /** The kind of an uploaded file: its name decides, else the magic bytes and the content type; any other file is refused as an unsupported type. */
    private kindOf(name: string, bytes: Uint8Array, contentType: string): TextKind {
        const kind = fileTextKind(name) ?? sniffTextKind(bytes, contentType)
        if (kind === null) {
            throw new DocumentsError({
                code: DocumentsErrorCode.TypeUnsupported,
                params: { type: contentType || "unknown" },
            })
        }
        return kind
    }

    /** The text of one Drive file the token can open. */
    readDriveFile(token: string, fileId: string): Promise<DriveFileText> {
        return this.drive.readFile(token, fileId)
    }

    /** The files of a Drive folder, and the folders nested below it. */
    listDriveFolder(token: string, folderId: string): Promise<DriveFolderListing> {
        return this.folders.listFolder(token, folderId)
    }

    /** A new access token for a refresh token. */
    refreshGoogleAccessToken(refreshToken: string): Promise<GoogleAccessToken> {
        return this.drive.refreshAccessToken(refreshToken)
    }
}
