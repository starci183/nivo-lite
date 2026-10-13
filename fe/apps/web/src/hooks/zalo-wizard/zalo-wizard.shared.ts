import type { CatalogReader } from "@/hooks/connection-wizard"
import type { DbOutcome } from "@/modules/db"
import type { FirstEventState, ZaloAuthorizeUrl, ZaloWizardConnection } from "@/modules/types"

/** The steps of the Zalo wizard, in order. */
export const ZALO_STEPS = ["app", "follow", "authorize", "verify", "agent"] as const

/** The least length of the OA Secret Key the owner pastes from Zalo. */
const MIN_SECRET_LENGTH = 8

/** What the owner types on the first two steps. */
export interface ZaloFields {
    readonly name: string
    readonly appId: string
    readonly appSecret: string
    readonly oaSecret: string
}

/** The commands the connected entry hands the Zalo wizard (each one already knows the active workspace). */
export interface ZaloActions {
    readonly start: (
        fields: Pick<ZaloFields, "name" | "appId" | "appSecret">,
    ) => Promise<DbOutcome<ZaloWizardConnection>>
    readonly resume: (connectionId: string) => Promise<DbOutcome<ZaloWizardConnection>>
    readonly saveOaSecret: (connectionId: string, oaSecret: string) => Promise<DbOutcome<true>>
    readonly authorize: (connectionId: string) => Promise<DbOutcome<ZaloAuthorizeUrl>>
    readonly setAgents: (connectionId: string, agents: ReadonlyArray<string>) => Promise<DbOutcome<true>>
    readonly checkFirstEvent: (connectionId: string) => Promise<DbOutcome<FirstEventState>>
}

/** The sentence for a sign-in that did not end well, or null when it did (or there was none). */
export const zaloFailureOf = (returned: string | undefined, tw: CatalogReader): string | null => {
    if (returned === "denied") return tw("zaloAuthDenied")
    if (returned === "failed") return tw("zaloAuthFailed")
    return returned === "expired" ? tw("zaloAuthExpired") : null
}

/** Where a resumed connection continues: back to the sign-in after a failure, on to the check once authorized, else where the keys stand. */
export const zaloStartStepOf = (conn: ZaloWizardConnection, failed: boolean): number => {
    if (failed) return 2
    if (conn.authorized) return 3
    return conn.oaSecretSaved ? 2 : 1
}

/** Whether the follow-along step may go on: the OA Secret Key is stored, or a long enough one is typed. */
export const canSaveOaSecret = (conn: ZaloWizardConnection | null, fields: ZaloFields): boolean =>
    (conn !== null && conn.oaSecretSaved) || fields.oaSecret.trim().length >= MIN_SECRET_LENGTH
