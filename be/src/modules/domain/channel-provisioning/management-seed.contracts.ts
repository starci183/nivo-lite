import type { ChannelSeed } from "@modules/domain/channel-connections"

/** The schema name a management-seed document carries. */
export const MANAGEMENT_SEED_SCHEMA = "nivo/management-seed@1"

/** The ids of the management workspace connections: the same in every environment, so a re-seed never makes a second row. */
export const MANAGEMENT_CONNECTION_IDS = {
    sepay: "44c471c0-1a75-42e2-ac4b-09dded78c263",
    payos: "103ceb10-102c-4904-9ce4-d9c1b03ddcef",
    zaloOa: "ff2e59dc-5ed2-4327-8a73-ca3526bc3b6f",
    telegram: "72f2699d-7f93-45e1-964a-8a2228137985",
    google: "3cdf964f-f19f-4dde-80ff-c655deb2bd8a",
} as const

/** The mail server of the management workspace. */
export interface ManagementSmtp {
    /** The mail server. */
    readonly host: string
    /** The mail port. */
    readonly port: number
    /** The login. */
    readonly user: string
    /** The password. */
    readonly password: string
    /** The sender mailbox. */
    readonly from: string
}

/** One management-seed document, checked: who owns the workspace, what it is called and what its connections hold. */
export interface ManagementSeed {
    /** The name of the workspace. */
    readonly workspaceName: string
    /** The sign-in address of its owner. */
    readonly ownerEmail: string
    /** Its own mail server, when the document gives one. */
    readonly smtp: ManagementSmtp | undefined
    /** Its Telegram, Zalo OA, SePay, payOS and (when its OAuth client is given) Google connections. */
    readonly channels: ChannelSeed
}
