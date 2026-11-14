import type { ChannelSeed } from "@modules/domain/channel-connections"
import type { ConnectionRecord } from "@modules/domain/connections"

/** The owner who seeds the channels, in the workspace they are seeded into. */
export const SEED_ACTOR = { principalId: "owner-1", workspaceId: "ws-1" }

/** The fixed ids the seed gives each connection. */
export const SEED_IDS = {
    sepay: "44c471c0-1a75-42e2-ac4b-09dded78c263",
    payos: "103ceb10-102c-4904-9ce4-d9c1b03ddcef",
    zaloOa: "ff2e59dc-5ed2-4327-8a73-ca3526bc3b6f",
    telegram: "72f2699d-7f93-45e1-964a-8a2228137985",
    google: "3cdf964f-f19f-4dde-80ff-c655deb2bd8a",
}

/** A Telegram bot token of the seed. */
export const SEED_TELEGRAM_TOKEN: string = ["123456789", "AAEabcdefghijklmnopqrstuvwxyz012345"].join(":")

/** A SePay webhook key of the seed. */
export const SEED_SEPAY_KEY: string = ["nivo", "ab12".repeat(16)].join("_")

/** A SePay API token of the seed. */
export const SEED_SEPAY_API_TOKEN: string = ["api", "token", "1"].join("-")

/** A seed that names the four connections and no credential. */
export const BARE_SEED: ChannelSeed = {
    telegram: { id: SEED_IDS.telegram },
    zaloOa: { id: SEED_IDS.zaloOa },
    sepay: { id: SEED_IDS.sepay },
    payos: { id: SEED_IDS.payos },
}

/** A seed that names the four connections with every credential. */
export const FULL_SEED: ChannelSeed = {
    telegram: { id: SEED_IDS.telegram, token: SEED_TELEGRAM_TOKEN },
    zaloOa: { id: SEED_IDS.zaloOa, appId: "1234567", appSecret: "app-secret-1", oaSecret: "oa-secret-1" },
    sepay: {
        id: SEED_IDS.sepay,
        bankCode: "vcb",
        accountNumber: "0123456789",
        holder: "nivo",
        apiKey: SEED_SEPAY_KEY,
        apiToken: SEED_SEPAY_API_TOKEN,
    },
    payos: { id: SEED_IDS.payos, clientId: "client", apiKey: "payos-key-1", checksumKey: "checksum-1" },
}

/** A connected connection row of the seeding workspace. */
export const seededRecordOf = (id: string, provider: ConnectionRecord["provider"], meta = {}): ConnectionRecord => ({
    id,
    workspaceId: SEED_ACTOR.workspaceId,
    provider,
    name: provider,
    meta,
    status: "connected",
    lastError: null,
    environment: "live",
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: SEED_ACTOR.principalId,
    createdAt: "2026-11-03T00:00:00.000Z",
})
