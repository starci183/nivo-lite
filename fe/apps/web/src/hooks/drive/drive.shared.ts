/** The origin the sources added from Google Drive carry, which the progress pane lists by. */
export const DRIVE_ORIGIN = "google_drive"

/** How often the progress pane asks for the state of the sources being read. */
export const DRIVE_PROGRESS_POLL_MS = 5000

/** Where Google sends the owner back after the page asked for the grant. */
export const DRIVE_PAGE_PATH = "/connections/drive"

/** Where Google sends the owner back after the hub wizard asked for the grant. */
export const DRIVE_WIZARD_PATH = "/connections"

/** The setup steps of the Google Drive page. */
export type DriveStepId = "grant" | "choose" | "brain"

/** Where the workspace grant stands. */
export type DriveGrantStanding = "none" | "connected" | "lost"

/** The grant standing the back end named, or `none` for a word it does not know. */
export const driveStandingOf = (value: string): DriveGrantStanding => {
    if (value === "connected" || value === "lost") return value
    return "none"
}

/** The sentence a reason in `?drive=error&reason=` stands for. */
export type DriveFailureKey = "failDenied" | "failScope" | "failUnavailable" | "failNoRefresh" | "failState" | "failGeneric"

/** The sentence of the reason the Google callback brought back; a reason this app does not know reads as the generic one. */
export const driveFailureKeyOf = (reason: string): DriveFailureKey => {
    switch (reason) {
        case "denied":
            return "failDenied"
        case "scope":
            return "failScope"
        case "unavailable":
            return "failUnavailable"
        case "no_refresh":
            return "failNoRefresh"
        case "state":
            return "failState"
        default:
            return "failGeneric"
    }
}

const READABLE_EXTENSIONS: ReadonlyArray<string> = [".txt", ".md", ".csv", ".pdf", ".docx", ".xlsx", ".pptx"]
const READABLE_GOOGLE_TYPES: ReadonlySet<string> = new Set([
    "application/vnd.google-apps.document",
    "application/vnd.google-apps.spreadsheet",
    "application/vnd.google-apps.presentation",
])

/** The part of a Drive file the reading check needs. */
interface DriveFileKind {
    readonly name: string
    readonly mimeType: string
}

/** Whether NIVO reads this file: text, Markdown, CSV, PDF, Word, Excel and PowerPoint, and Google Docs, Sheets and Slides. */
export const isReadableDriveFile = (file: DriveFileKind): boolean => {
    if (READABLE_GOOGLE_TYPES.has(file.mimeType)) return true
    const name = file.name.toLowerCase()
    return READABLE_EXTENSIONS.some((extension) => name.endsWith(extension))
}

/** A Drive file as the page lists it. */
export interface DriveFileRow {
    readonly id: string
    readonly name: string
    readonly path: string
    readonly mimeType: string
    readonly sizeBytes: number | null
    readonly modifiedTime: string | null
    readonly url: string
}

/** A folder (or a set of chosen files) the owner can tick files from. */
export interface DriveListing {
    readonly name: string
    readonly files: ReadonlyArray<DriveFileRow>
    /** The folder had more files than NIVO lists, so only the first were. */
    readonly truncated: boolean
    /** Google did not let the picked folder be listed: the owner chooses the files inside it. */
    readonly empty: boolean
}

/** The files of a listing NIVO can read: the ones that can be ticked. */
export const readableFilesOf = (listing: DriveListing): ReadonlyArray<DriveFileRow> =>
    listing.files.filter(isReadableDriveFile)
