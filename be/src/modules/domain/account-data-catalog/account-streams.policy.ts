import type { AccountDataTypeDef } from "@modules/domain/account-data"
import type { AccountStream, AccountStreamExemption } from "./account-streams.contracts"

/**
 * The public fact of each provider's connection that names the stream it reads (owner rule `triggerOneSource2026_11_12`): two accounts
 * whose fact is equal read the same stream, so one trigger may bind only one of them. Declared here; the engine's trigger check reads it.
 * Each key is the one the provider capability writes into `connections.public_meta`.
 */
export const ACCOUNT_STREAMS: ReadonlyArray<AccountStream> = [
    // the bank account of the feed (channel-connections/money-provider.policy.ts `accountFacts`)
    { provider: "casso", streamIdentity: { metaKeys: ["account_number"] } },
    // the Facebook page and the Instagram account (meta-connections/meta-connections.service.ts, page choice)
    { provider: "meta", streamIdentity: { metaKeys: ["page_id", "ig_id"] } },
    { provider: "sepay", streamIdentity: { metaKeys: ["account_number"] } },
    // the bot (channel-connections/channel-connections.service.ts, BotInUse check)
    { provider: "telegram", streamIdentity: { metaKeys: ["bot_id"] } },
    // the Official Account (connections/connections.service.ts, OAuth grant)
    { provider: "zalo_oa", streamIdentity: { metaKeys: ["oa_id"] } },
]

/** The providers that declare no stream identity, each with the reason. */
export const ACCOUNT_STREAM_EXEMPTIONS: ReadonlyArray<AccountStreamExemption> = [
    {
        provider: "creatomate",
        reason: "a render connection holds only its sealed API key; a render row is keyed by the render id the connection itself started",
    },
    {
        provider: "imap",
        reason: "the mailbox address is in the sealed credential; the public meta holds only the folder settings (`config`)",
    },
    {
        provider: "json2video",
        reason: "a render connection holds only its sealed API key; a render row is keyed by the render id the connection itself started",
    },
    {
        provider: "payos",
        reason: "a payOS connection stores no bank account (needsBank false) and no other public fact naming its account",
    },
    {
        provider: "shotstack",
        reason: "a render connection holds only its sealed API key; a render row is keyed by the render id the connection itself started",
    },
    { provider: "webhook", reason: "a generic webhook is its own stream: each connection has its own address" },
]

/**
 * What is wrong with a stream declaration against a catalog: each provider that owns a `wakes` type but has neither a stream identity
 * nor an exemption with a reason, each provider declared twice (or both identified and exempt), each identity naming no key.
 */
export const streamGapsOf = (
    catalog: ReadonlyArray<AccountDataTypeDef>,
    streams: ReadonlyArray<AccountStream>,
    exemptions: ReadonlyArray<AccountStreamExemption>,
): ReadonlyArray<string> => {
    const declared = [...streams, ...exemptions].map((entry) => entry.provider)
    const covered = new Set([
        ...streams.map((stream) => stream.provider),
        ...exemptions.filter((exempt) => exempt.reason !== "").map((exempt) => exempt.provider),
    ])
    const waking = [...new Set(catalog.filter((def) => def.wakes === true).flatMap((def) => def.provider ?? []))]
    return [
        ...waking
            .filter((provider) => !covered.has(provider))
            .map((provider) => `${provider}: wakes with no stream identity`),
        ...declared
            .filter((provider, index) => declared.indexOf(provider) !== index)
            .map((provider) => `${provider}: declared twice`),
        ...streams
            .filter((stream) => stream.streamIdentity.metaKeys.length === 0)
            .map((stream) => `${stream.provider}: no key`),
    ]
}
