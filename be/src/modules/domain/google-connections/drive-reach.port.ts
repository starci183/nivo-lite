import type { ConnectionRecord } from "@modules/domain/connections"
import type { DocumentsPort, DriveAccess, DriveFolderListing } from "@modules/integrations/documents"

/** Where the Google Drive access of a workspace stands (`none`, `connected` or `lost`), as the integration's grant reports it. */
export type DriveGrantState = Awaited<ReturnType<DriveAccess["state"]>>

/** The text of one Drive file with the name it has in Drive, as the integration reads it. */
export type DriveFileRead = Awaited<ReturnType<DocumentsPort["readDriveFile"]>>

export type { DriveFolderListing }

/**
 * What the Google Drive account of a workspace is asked, the one port its two implementations answer (the live one reads Drive with the
 * stored grant's token, the sandbox one answers from its hardcoded catalogue): `DriveReachRegistryService.portFor(account)` picks. Every
 * failure is a `DocumentsError` (the integration's own error family): a grant that was never given or was lost, a token Drive refused, an
 * item the account cannot open, a file that cannot be read, Drive unavailable. A listing and a read are reads: nothing here has an effect
 * whose outcome could be unknown.
 */
export interface DriveReachPort {
    /** The provider key. */
    readonly provider: "google_drive"
    /** Whether the workspace has given Drive access, never did, or lost it. */
    grant(connection: ConnectionRecord): Promise<DriveGrantState>
    /** The files of a Drive folder, and the folders nested below it. */
    listFolder(connection: ConnectionRecord, folderId: string): Promise<DriveFolderListing>
    /** The text of one Drive file the account can open (its type and size are checked before any download). */
    readFile(connection: ConnectionRecord, fileId: string): Promise<DriveFileRead>
}
