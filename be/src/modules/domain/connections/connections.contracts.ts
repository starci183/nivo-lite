/** A connection a delivery arrived on, when it is of the provider and not disconnected. */
export interface IntakeConnection {
    /** The connection id. */
    readonly id: string
    /** The workspace the connection belongs to. */
    readonly workspaceId: string
    /** The connection status: pending, connected or error. */
    readonly status: string
}

/** The first thing a connection received, kept for the wizard's check step. */
export interface FirstEvent {
    /** An amount, for the providers that carry one; zero for a message. */
    readonly amount: number
    /** Who or what the event was about. */
    readonly content: string
    /** When it arrived, ISO 8601. */
    readonly at: string
    /** The first characters of the text, when it had any. */
    readonly text: string
}

/** One connection as the health check reads it. */
export interface HealthCandidate {
    /** The connection id. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** The provider key. */
    readonly provider: string
    /** The connection name. */
    readonly name: string
    /** The connection status. */
    readonly status: string
    /** The last error the connection reported; empty when none. */
    readonly lastError: string
    /** When the connection last received an event, as text; empty when never. */
    readonly lastEventAt: string
    /** When the connection was created, as text. */
    readonly createdAt: string
    /** The health state already recorded: ok, silent, failing, or empty when none. */
    readonly health: string
}

/** The health verdict recorded on a connection. */
export interface HealthMark {
    /** ok, silent or failing. */
    readonly state: string
    /** Why, in a short sentence; empty for ok. */
    readonly reason: string
    /** When it was judged, ISO 8601. */
    readonly checkedAt: string
}

/** The result of a wizard job, written next to its ticket on the connection row. */
export interface WizardSettlement {
    /** What the job was asked to do. */
    readonly command: string
    /** done or failed. */
    readonly state: "done" | "failed"
    /** The page the owner opens next, when the command produced one; empty otherwise. */
    readonly url: string
    /** The code of the refusal, when it failed; empty otherwise. */
    readonly code: string
    /** True when the job sealed the OA Secret Key, which the wizard then shows as saved. */
    readonly oaSecretSaved: boolean
}
