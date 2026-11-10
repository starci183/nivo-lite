import type { BadgeTone } from "@starci/grammar/common"
import type { DriveGrantStanding } from "@/hooks/drive"
import type { LedgerState } from "@/hooks/googleLedger"
import type { ConnectionLifecycle } from "@/modules/types"

/** What the Google account page knows of each service switched on inside it. */
export interface GoogleServicesStanding {
    /** Where the Drive read grant stands; undefined while it is read. */
    readonly drive: DriveGrantStanding | undefined
    /** Where the Sheets ledger access stands; undefined while it is read. */
    readonly sheets: LedgerState | undefined
}

/** Whether a Drive grant is switched on (granted, even if the first sync is not done). */
const isDriveOn = (drive: DriveGrantStanding | undefined): boolean => drive === "connected"

/** Whether the Sheets access is switched on (the access is given, with or without a chosen sheet). */
const isSheetsOn = (sheets: LedgerState | undefined): boolean => sheets === "granted" || sheets === "ready"

/** How many Google services are switched on in the account. */
export const servicesOnOf = (standing: GoogleServicesStanding): number =>
    Number(isDriveOn(standing.drive)) + Number(isSheetsOn(standing.sheets))

/** The phase of the shared four where an account with no service on stands: the grant. */
export const SETUP_GRANT_PHASE = 2

/**
 * Where the one Google account stands in the shared life: a revoked service needs the owner; while Drive is unfinished the account
 * stands where the setup card does (waiting for the first document, else the grant phase), whatever Sheets does; else it runs. Null
 * while either service is read.
 */
export const googleLifeOf = (
    drive: ConnectionLifecycle | null,
    sheets: LedgerState | undefined,
): ConnectionLifecycle | null => {
    if (drive === null || sheets === undefined) return null
    if (drive.id === "attention" || sheets === "lost") return { id: "attention" }
    // While the page shows Drive's setup card, the badge says that step, whatever Sheets does.
    if (drive.id === "waiting") return { id: "waiting", phase: 3 }
    if (drive.id !== "running") return { id: "setup", phase: SETUP_GRANT_PHASE }
    return { id: "running" }
}

/** The catalog keys of the permissions the account has given, in reading order. */
export const permissionKeysOf = (standing: GoogleServicesStanding): ReadonlyArray<"permDrive" | "permSheets"> => [
    ...(isDriveOn(standing.drive) ? (["permDrive"] as const) : []),
    ...(isSheetsOn(standing.sheets) ? (["permSheets"] as const) : []),
]

/** The first of the emails that is not blank, else blank. */
export const firstEmailOf = (...emails: ReadonlyArray<string | undefined>): string =>
    emails.find((email) => (email ?? "") !== "") ?? ""

/** One row of the services list: the service, where it stands, and the one command it needs. */
export interface GoogleServiceView {
    readonly id: string
    readonly title: string
    readonly description: string
    /** The service's own mark (GOOGLE_SERVICE_LOGO). */
    readonly logo: string
    readonly badge?: { readonly label: string; readonly tone: BadgeTone; readonly isDot?: boolean }
    /** Absent on a service that is not available yet. */
    readonly action?: { readonly label: string; readonly run: () => void }
}
