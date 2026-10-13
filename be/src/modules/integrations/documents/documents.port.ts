import type {
    DocumentText,
    MaybeDriveAccess,
    MaybeFolderId,
    DriveFileText,
    DriveFolderListing,
    GoogleAccessToken,
} from "./documents.contracts"

/** The documents port: turns links, files and Drive items into text. Every failure is a `DocumentsError`. */
export interface DocumentsPort {
    /**
     * The text of a pasted link. `drive` is the workspace's Drive access for sources a signed-in person added, null for API keys. A public
     * address is read first; a Google file that is not public is read with the Drive access when there is one.
     */
    readLink(raw: string, drive: MaybeDriveAccess): Promise<DocumentText>
    /** The Drive id of the folder a pasted address names, or null when the address is not a Drive folder. */
    driveFolderOf(raw: string): MaybeFolderId
    /** True when a file name has an extension that can be read, or no extension at all (the kind is then sniffed after the download). */
    canReadFileName(name: string): boolean
    /** The text of uploaded file bytes: the name decides the kind, else the magic bytes and the content type do. */
    readFile(name: string, bytes: Uint8Array, contentType: string): Promise<string>
    /** The text of one Drive file the token can open (the type and size are checked before any download). */
    readDriveFile(token: string, fileId: string): Promise<DriveFileText>
    /** The files of a Drive folder, and the folders nested below it, read with a token. */
    listDriveFolder(token: string, folderId: string): Promise<DriveFolderListing>
    /** A new access token for a refresh token. */
    refreshGoogleAccessToken(refreshToken: string): Promise<GoogleAccessToken>
}
