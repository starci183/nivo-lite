import type { SandboxCase, SandboxCatalogue } from "@modules/domain/provider-sandbox"
import type { DriveFileRead, DriveFolderListing } from "./drive-reach.port"

/** The provider key of a Google Drive account. */
export const GOOGLE_DRIVE_SANDBOX_PROVIDER = "google_drive"

/** The operations the cases answer in the sandbox call log and in the account's next-case selector: the grant, a folder listing, a file read. */
export const GOOGLE_DRIVE_GRANT_OPERATION = "grant"
export const GOOGLE_DRIVE_LIST_OPERATION = "list"
export const GOOGLE_DRIVE_READ_OPERATION = "read"

/** The ids of the cases, by what they prove (the implementation reads `state.nextCase` against them; the first of each operation is its default). */
export const GOOGLE_DRIVE_CASE = {
    granted: "GOOGLE_DRIVE-1",
    notGranted: "GOOGLE_DRIVE-2",
    grantLost: "GOOGLE_DRIVE-3",
    listed: "GOOGLE_DRIVE-4",
    emptyFolder: "GOOGLE_DRIVE-5",
    truncated: "GOOGLE_DRIVE-6",
    listTokenRejected: "GOOGLE_DRIVE-7",
    listNoAccess: "GOOGLE_DRIVE-8",
    listUnavailable: "GOOGLE_DRIVE-9",
    listGrantLost: "GOOGLE_DRIVE-10",
    read: "GOOGLE_DRIVE-11",
    tooLarge: "GOOGLE_DRIVE-12",
    typeUnsupported: "GOOGLE_DRIVE-13",
    readNoAccess: "GOOGLE_DRIVE-14",
    readUnavailable: "GOOGLE_DRIVE-15",
} as const

/** The name of the sandbox account's folder. */
export const GOOGLE_DRIVE_SANDBOX_FOLDER_NAME = "Tai lieu cua hang"

/** One file of the sandbox Drive: what a listing says of it and the text a read gives. */
interface SandboxDriveFile {
    readonly id: string
    readonly name: string
    readonly mimeType: string
    readonly size: number | null
    readonly modifiedTime: string
    readonly text: string
}

/** The files of the sandbox folder (fixed; their ids are the sandbox's own, not real Drive ids). */
export const GOOGLE_DRIVE_SANDBOX_FILES: ReadonlyArray<SandboxDriveFile> = [
    {
        id: "sbx-drive-prices",
        name: "Bang gia 2026",
        mimeType: "application/vnd.google-apps.document",
        size: null,
        modifiedTime: "2026-11-05T09:00:00.000Z",
        text: "Bang gia dich vu 2026. Goi co ban: 500.000 dong moi thang. Goi nang cao: 1.200.000 dong moi thang. Gia chua gom VAT.",
    },
    {
        id: "sbx-drive-returns",
        name: "Chinh sach doi tra.pdf",
        mimeType: "application/pdf",
        size: 183_204,
        modifiedTime: "2026-10-20T04:30:00.000Z",
        text: "Chinh sach doi tra. Khach duoc doi hoac tra hang trong 7 ngay ke tu ngay nhan, hang con nguyen tem va chua qua su dung.",
    },
    {
        id: "sbx-drive-stock",
        name: "Ton kho thang 11",
        mimeType: "application/vnd.google-apps.spreadsheet",
        size: null,
        modifiedTime: "2026-11-12T11:00:00.000Z",
        text: "sku,ten,ton\nSKU-1,Ao thun,20\nSKU-2,Non luoi trai,35\nSKU-3,Tui vai,8",
    },
]

/** The address that opens a sandbox file in the browser (the sandbox's own scheme: it names no real host). */
const urlOf = (id: string): string => `sandbox://drive/files/${id}`

/** The listing of the sandbox folder: the three files at the top of it. */
export const GOOGLE_DRIVE_SANDBOX_LISTING: DriveFolderListing = {
    name: GOOGLE_DRIVE_SANDBOX_FOLDER_NAME,
    files: GOOGLE_DRIVE_SANDBOX_FILES.map((file) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        modifiedTime: file.modifiedTime,
        path: "",
        url: urlOf(file.id),
    })),
    truncated: false,
}

/** The listing of an empty folder: nothing in it. */
export const GOOGLE_DRIVE_SANDBOX_EMPTY_LISTING: DriveFolderListing = { name: GOOGLE_DRIVE_SANDBOX_FOLDER_NAME, files: [], truncated: false }

/** The listing the limits cut: the same three files and the flag that says there are more. */
export const GOOGLE_DRIVE_SANDBOX_CUT_LISTING: DriveFolderListing = { ...GOOGLE_DRIVE_SANDBOX_LISTING, truncated: true }

/** What reading a file of the sandbox Drive answers (its name and text), or null for an id the sandbox Drive holds none under. */
export const googleDriveSandboxReadOf = (fileId: string): DriveFileRead | null => {
    const file = GOOGLE_DRIVE_SANDBOX_FILES.find((one) => one.id === fileId)
    return file === undefined ? null : { name: file.name, text: file.text }
}

/** The outbound cases of the Drive account: the account's NEXT CASE of each operation picks one, the first of the operation answers while nothing is picked. */
export const GOOGLE_DRIVE_SANDBOX_CASES: ReadonlyArray<SandboxCase> = [
    { id: GOOGLE_DRIVE_CASE.granted, label: "The access is given: the workspace's Drive grant is connected", operation: GOOGLE_DRIVE_GRANT_OPERATION, default: true },
    { id: GOOGLE_DRIVE_CASE.notGranted, label: "The access was never given: the grant is none", operation: GOOGLE_DRIVE_GRANT_OPERATION },
    { id: GOOGLE_DRIVE_CASE.grantLost, label: "The access was revoked on the Google side: the grant is lost", operation: GOOGLE_DRIVE_GRANT_OPERATION },
    {
        id: GOOGLE_DRIVE_CASE.listed,
        label: "A folder with files: the listing names three files (a price list document, a returns policy PDF, a stock sheet)",
        operation: GOOGLE_DRIVE_LIST_OPERATION,
        default: true,
    },
    { id: GOOGLE_DRIVE_CASE.emptyFolder, label: "An empty folder: the listing holds no file", operation: GOOGLE_DRIVE_LIST_OPERATION },
    { id: GOOGLE_DRIVE_CASE.truncated, label: "A big folder: the listing stops at the file limit and says it was cut", operation: GOOGLE_DRIVE_LIST_OPERATION },
    { id: GOOGLE_DRIVE_CASE.listTokenRejected, label: "Drive refuses the token (401): the listing is refused, the token needs a refresh", operation: GOOGLE_DRIVE_LIST_OPERATION },
    { id: GOOGLE_DRIVE_CASE.listNoAccess, label: "The connected account cannot open the folder (403 / 404): the listing is refused", operation: GOOGLE_DRIVE_LIST_OPERATION },
    { id: GOOGLE_DRIVE_CASE.listUnavailable, label: "Drive fails with a server error (5xx): the listing is unavailable and worth another try", operation: GOOGLE_DRIVE_LIST_OPERATION },
    { id: GOOGLE_DRIVE_CASE.listGrantLost, label: "The access was revoked on the Google side: the listing is refused as the live grant refuses it (grant lost)", operation: GOOGLE_DRIVE_LIST_OPERATION },
    {
        id: GOOGLE_DRIVE_CASE.read,
        label: "A file is read: its name and text come back (a file the sandbox Drive does not hold is refused as one the account cannot open)",
        operation: GOOGLE_DRIVE_READ_OPERATION,
        default: true,
    },
    { id: GOOGLE_DRIVE_CASE.tooLarge, label: "The file is larger than the integration reads: refused before any download", operation: GOOGLE_DRIVE_READ_OPERATION },
    { id: GOOGLE_DRIVE_CASE.typeUnsupported, label: "The file is of a type that cannot be read (a picture, an archive): refused", operation: GOOGLE_DRIVE_READ_OPERATION },
    { id: GOOGLE_DRIVE_CASE.readNoAccess, label: "The connected account cannot open the file (403 / 404): refused", operation: GOOGLE_DRIVE_READ_OPERATION },
    { id: GOOGLE_DRIVE_CASE.readUnavailable, label: "Drive fails with a server error (5xx): the read is unavailable and worth another try", operation: GOOGLE_DRIVE_READ_OPERATION },
]

/** The Google Drive account's hardcoded catalogue, registered at boot. */
export const GOOGLE_DRIVE_SANDBOX_CATALOGUE: SandboxCatalogue = {
    provider: GOOGLE_DRIVE_SANDBOX_PROVIDER,
    cases: GOOGLE_DRIVE_SANDBOX_CASES,
}
