/** Test or live: the SePay test mode books nothing. */
export type SepayEnvironment = "test" | "live"

/** How the webhook door answered one delivery. */
export type SepayEventOutcome = "accepted" | "duplicate" | "unauthorized"

/** What a delivery carried. */
export type SepayEventKind = "credit" | "debit" | "ping"

/** The health tiles of a SePay connection. */
export interface SepayHealthView {
    /** When the last delivery arrived, ISO 8601; null when none ever did. */
    readonly lastWebhookAt: string | null
    /** Deliveries of the last 24 hours whose API key was valid. */
    readonly validCount: number
    /** Deliveries of the last 24 hours. */
    readonly totalCount: number
    /** Repeated deliveries blocked in the last 24 hours. */
    readonly duplicateCount: number
}

/** The page read model of one SePay connection; the key and the full account number are never in it. */
export interface SepayConnectionView {
    readonly id: string
    readonly name: string
    readonly status: string
    readonly environment: SepayEnvironment
    readonly lastError: string | null
    readonly bankCode: string
    readonly bank: string
    readonly accountMasked: string
    readonly hasFullAccount: boolean
    readonly holder: string
    readonly webhookUrl: string
    readonly apiKeyMasked: string
    readonly pingSeenAt: string | null
    readonly transactionSeenAt: string | null
    readonly health: SepayHealthView
    readonly agentIds: ReadonlyArray<string>
}

/** One delivery to the webhook door, newest first in a list. */
export interface SepayEventView {
    readonly id: string
    readonly at: string
    readonly outcome: SepayEventOutcome
    readonly kind: SepayEventKind
    readonly amountVnd: number | null
    readonly providerEventId: string | null
    readonly environment: SepayEnvironment
}

/** Where one step of the test checklist stands. */
export type SepayStepState = "done" | "active" | "pending"

/** One step of the test checklist. */
export interface SepayStepView {
    readonly id: "ping" | "simulate" | "wait" | "receive"
    readonly state: SepayStepState
}

/** The bank account form of the Setup tab. */
export interface SepayAccountForm {
    readonly bank: string
    readonly account: string
    readonly holder: string
}

/** One agent that may use a SePay connection. */
export interface SepayAgentView {
    readonly id: string
    readonly name: string
    readonly isOn: boolean
}
