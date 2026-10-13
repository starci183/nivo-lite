/** One file of a Google Drive folder. */
export class DriveFileResponse {
    /** The Drive id. */
    id!: string
    /** The name in Drive. */
    name!: string
    /** The Drive type. */
    mimeType!: string
    /** The size in bytes, when Drive reports it. */
    size!: number | null
    /** The last change, when Drive reports it. */
    modifiedTime!: string | null
    /** The folders between the listed folder and the file, joined by "/"; empty at the top. */
    path!: string
}

/** The files of a Google Drive folder. */
export class FolderResponse {
    /** The name of the folder. */
    name!: string
    /** The files, folders below it included. */
    files!: Array<DriveFileResponse>
    /** True when the listing was cut at the limits. */
    truncated!: boolean
}

/** The files of a folder picked in the Google Picker. */
export class PickedFolderResponse extends FolderResponse {
    /** True when Google returned no files; the owner is asked to pick the files inside. */
    empty!: boolean
}
