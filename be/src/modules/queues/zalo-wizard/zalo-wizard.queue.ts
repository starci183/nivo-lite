import { isRecord } from "@modules/platform/primitives"

/** The queue name: the contract between the database functions the wizard calls and the processor of the run-zalo-wizard job (the durable queue name). */
export const ZALO_WIZARD_QUEUE = "zalo_wizard"

/** What a wizard job does: seal the app keys of a new connection, seal the OA Secret Key, or build the Zalo permission URL. */
export type ZaloWizardCommand = "app" | "oa" | "begin"

/** The payload of one run-zalo-wizard job, written by the `zalo_wizard_*` database functions; it never carries a secret. */
export interface ZaloWizardPayload {
    /** The workspace the signed-in owner proved ownership of. */
    readonly workspaceId: string
    /** The Zalo connection the wizard works on. */
    readonly connectionId: string
    /** What to do. */
    readonly command: ZaloWizardCommand
    /** The ticket written on the connection row; the result is written next to the same ticket. */
    readonly ticket: string
}

/** True when a job payload is the payload of a run-zalo-wizard job. */
export const isZaloWizardPayload = (value: unknown): value is ZaloWizardPayload => {
    if (!isRecord(value)) return false
    const { workspaceId, connectionId, command, ticket } = value
    return (
        typeof workspaceId === "string" &&
        typeof connectionId === "string" &&
        (command === "app" || command === "oa" || command === "begin") &&
        typeof ticket === "string"
    )
}
