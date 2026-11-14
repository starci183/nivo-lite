import type { TriggerVerb } from "@nivo-lite/agent-sdk/names"
import { ENGINE_ROAD, type StreamFact, type StreamIdentity } from "./trigger-specs.contracts"
import { TRIGGERS } from "./trigger-specs.registry"
import { triggerSpecOf } from "./trigger-specs.policy"

/*
 * STREAM IDENTITY (owner key `triggerOneSource2026_11_12`, CORRECTED 2026-11-12: one source per underlying stream). Each provider adapter of
 * the registry declares, as DATA (`TriggerAdapterSpec.stream`), which of a connection's public facts name the stream its account reads.
 * Two accounts read the same stream exactly when their keys are EQUAL strings after each fact's canonical form; nothing is matched
 * loosely, and an account whose facts are missing reads an unknown stream, which is its OWN (`connection:<id>`).
 */

/** The key prefix of an account whose stream is unknown: its own stream, by connection id. */
const OWN_STREAM = "connection"

/** One fact in its canonical form, or null when the connection does not store it (or it is blank in that form). */
const canonicalOf = (fact: StreamFact, facts: Readonly<Record<string, string>>): string | null => {
    const value = facts[fact.key]
    if (value === undefined) return null
    const trimmed = value.trim()
    const formed = ((): string => {
        switch (fact.form) {
            case "digits":
                return [...trimmed].filter((char) => char >= "0" && char <= "9").join("")
            case "upper-case":
                return trimmed.toUpperCase()
            case "lower-case":
                return trimmed.toLowerCase()
            case "trimmed":
                return trimmed
        }
    })()
    return formed === "" ? null : formed
}

/** The stream identity a provider's adapter of a verb declares, or undefined (the engine's road, or a provider not serving the verb). */
const identityOf = (verb: TriggerVerb, provider: string): StreamIdentity | undefined =>
    triggerSpecOf(verb)?.adapters.find((adapter) => adapter.provider === provider)?.stream

/**
 * The stream one account of a provider reads for a verb, from the connection's public facts: `<kind>:<fact>:...` with every fact in its
 * canonical form (`bank-account:VCB:0123456789`, `mailbox:ketoan@shop.vn`, `zalo-oa:4433`, `telegram-bot:777`, `facebook-page:<id>`,
 * `instagram-account:<id>`); null when the adapter declares none or the connection stores one of the facts not at all.
 */
export const streamOf = (verb: TriggerVerb, provider: string, facts: Readonly<Record<string, string>>): string | null => {
    const identity = identityOf(verb, provider)
    if (identity === undefined || "ownAccount" in identity) return null
    const parts = identity.facts.map((fact) => canonicalOf(fact, facts))
    if (parts.includes(null)) return null
    return [identity.kind, ...parts].join(":")
}

/**
 * The stream an account is a source of: the one it reads (`streamOf`), else its own (`connection:<id>`), never shared: an adapter that
 * declares `ownAccount` reads no fact, so each of its accounts is its own stream.
 */
export const sourceStreamOf = (
    verb: TriggerVerb,
    provider: string,
    connectionId: string,
    facts: Readonly<Record<string, string>>,
): string => streamOf(verb, provider, facts) ?? `${OWN_STREAM}:${connectionId}`

/** The providers of the registry whose adapter declares no stream identity: every account of theirs would be its own stream. */
export const unknownStreamProviders = (): ReadonlyArray<string> => [
    ...new Set(
        Object.values(TRIGGERS).flatMap((spec) =>
            spec.adapters.flatMap((adapter) =>
                adapter.provider === ENGINE_ROAD || adapter.stream !== undefined ? [] : [adapter.provider],
            ),
        ),
    ),
]
