import type { ConnectionStatus, Environment } from "@modules/domain/connections"

/** How the door answered one SePay delivery. */
export type SepayEventOutcome = "accepted" | "duplicate" | "unauthorized"

/** What a SePay delivery carried: money in, money out, or nothing that moves money (SePay's test ping). */
export type SepayEventKind = "credit" | "debit" | "ping"

/** The raw bytes of a delivery body, as the HTTP door kept them. */
export type SepayRawBody = Buffer | undefined

/** The intake a delivery is handed to once its key was proven. */
export type SepayIntake = () => Promise<void>

/** One delivery to remember. */
export interface SepayDeliveryRecord {
    /** The connection the delivery arrived on. */
    readonly connectionId: string
    /** How the door answered. */
    readonly outcome: SepayEventOutcome
    /** What the delivery carried. */
    readonly kind: SepayEventKind
    /** The moved amount in VND, or null when none. */
    readonly amountVnd: number | null
    /** The SePay transaction id, or null when none. */
    readonly providerEventId: string | null
}

/** What a delivery body says, read without trusting it. */
export interface SepayDeliveryReading {
    /** What the delivery carried. */
    readonly kind: SepayEventKind
    /** The moved amount in VND, or null when none. */
    readonly amountVnd: number | null
    /** The SePay transaction id, or null when none. */
    readonly providerEventId: string | null
}

/** One remembered delivery as the page lists it. */
export interface SepayWebhookEvent {
    /** The row id. */
    readonly id: string
    /** When it arrived, ISO 8601. */
    readonly at: string
    /** How the door answered. */
    readonly outcome: SepayEventOutcome
    /** What it carried. */
    readonly kind: SepayEventKind
    /** The moved amount in VND, or null when none. */
    readonly amountVnd: number | null
    /** The SePay transaction id, or null when none. */
    readonly providerEventId: string | null
    /** The environment the connection ran in when it arrived. */
    readonly environment: Environment
}

/** The health of the webhook door of one connection. */
export interface SepayHealth {
    /** When the last delivery arrived, or null when none ever did. */
    readonly lastWebhookAt: string | null
    /** Deliveries in the last 24 hours whose API key was valid. */
    readonly validCount: number
    /** Deliveries in the last 24 hours. */
    readonly totalCount: number
    /** Repeated deliveries blocked in the last 24 hours. */
    readonly duplicateCount: number
}

/** The SePay connection page read model; the API key and the full account number are never in it. */
export interface SepayConnectionView {
    /** The connection id. */
    readonly id: string
    /** The name. */
    readonly name: string
    /** The status. */
    readonly status: ConnectionStatus
    /** Test or live. */
    readonly environment: Environment
    /** The last failure shown to the owner, or null. */
    readonly lastError: string | null
    /** The short bank code. */
    readonly bankCode: string
    /** The human name of the bank. */
    readonly bank: string
    /** The masked account number. */
    readonly accountMasked: string
    /** True when NIVO stores the full account number a VietQR needs. */
    readonly hasFullAccount: boolean
    /** The account holder. */
    readonly holder: string
    /** The address the owner pastes into SePay. */
    readonly webhookUrl: string
    /** The API key hidden but for its last 4 characters. */
    readonly apiKeyMasked: string
    /** When SePay's test ping was last seen, or null. */
    readonly pingSeenAt: string | null
    /** When a transaction (a test one in test mode) last landed, or null. */
    readonly transactionSeenAt: string | null
    /** The health tiles. */
    readonly health: SepayHealth
    /** The agents that use the connection. */
    readonly agentIds: ReadonlyArray<string>
}
