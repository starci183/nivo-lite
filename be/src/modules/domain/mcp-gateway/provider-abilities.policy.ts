import { TOOL } from "@nivo-lite/blocks-core"
import type { ModuleAgentAbilities } from "@nivo-lite/agent-sdk/module"
import type { AbilityMode, AbilityTicks, ProviderAttachmentView } from "@modules/domain/mcp-tool-grants"

/** The kind of a provider: a display category and the key a module's default abilities are declared under. It limits nothing. */
export type ProviderKind = "messaging" | "payment" | "books"

/** One ability of a provider: a right in business words, made of the tools it lets an agent call there. */
export interface ProviderAbility {
    /** The ability id, the same across the providers of a kind that have it (`customer.send`). */
    readonly id: string
    /** `read`: the tools only read the provider; `write`: at least one acts on it, so the tick carries `auto` or `ask`. */
    readonly scope: "read" | "write"
    /** The full names of the tools the ability holds. */
    readonly tools: ReadonlyArray<string>
    /**
     * The customer channels the provider serves, for an ability whose tool is one tool for every provider (`customer.message.send`):
     * the provider is then known only from the conversation, and the tool's executor asks with it.
     */
    readonly channels?: ReadonlyArray<string>
}

/** One provider a workspace can connect, with the abilities an agent can be given on it. */
export interface ProviderSpec {
    /** The provider key, as a connection names it. */
    readonly provider: string
    /** Its kind. */
    readonly kind: ProviderKind
    /** Its abilities; a provider with none cannot be attached. */
    readonly abilities: ReadonlyArray<ProviderAbility>
}

const sendOn = (...channels: ReadonlyArray<string>): ProviderAbility => ({
    id: "customer.send",
    scope: "write",
    tools: [TOOL.customerMessageSend],
    channels,
})

/**
 * Every provider and its abilities: the mechanics of the providers, in one place. A tool listed here is decided for a workspace's
 * agent by its attachments alone (`judgeAbility`); a tool listed nowhere here is no provider right and is judged as before (the
 * agent's tool set, its grants, the defaults). `payos` is a provider a workspace connects that no tool reaches yet.
 */
export const PROVIDER_CATALOGUE: ReadonlyArray<ProviderSpec> = [
    {
        provider: "zalo_oa",
        kind: "messaging",
        abilities: [sendOn("zalo")],
    },
    {
        provider: "telegram",
        kind: "messaging",
        abilities: [sendOn("telegram")],
    },
    { provider: "meta", kind: "messaging", abilities: [sendOn("facebook", "instagram")] },
    {
        provider: "sepay",
        kind: "payment",
        abilities: [
            {
                id: "transactions.read",
                scope: "read",
                tools: [TOOL.bankTransactions, "sepay.transactions.list", "sepay.transactions.debits", "sepay.status"],
            },
            { id: "credit.rematch", scope: "write", tools: [TOOL.paymentRematch] },
            { id: "qr.create", scope: "write", tools: [TOOL.paymentQrCreate] },
        ],
    },
    { provider: "payos", kind: "payment", abilities: [] },
    {
        provider: "google",
        kind: "books",
        abilities: [
            { id: "ledger.read", scope: "read", tools: [TOOL.ledgerStatus] },
            { id: "ledger.write", scope: "write", tools: [TOOL.ledgerAppend, TOOL.ledgerVoid] },
            { id: "drive.read", scope: "read", tools: ["drive.status", "drive.sources.list"] },
        ],
    },
]

/** The spec of a provider, or null for a key the catalogue does not know. */
export const providerSpecOf = (provider: string): ProviderSpec | null =>
    PROVIDER_CATALOGUE.find((spec) => spec.provider === provider) ?? null

/** The provider a customer channel goes through, or null for a channel of no provider (NIVO's own website chat). */
export const providerOfChannel = (channel: string): string | null =>
    PROVIDER_CATALOGUE.find((spec) => spec.abilities.some((ability) => ability.channels?.includes(channel) === true))
        ?.provider ?? null

/** One ability of one provider. */
interface Held {
    readonly provider: string
    readonly ability: ProviderAbility
}

/** Every ability, of every provider, that holds the tool. */
const holdersOf = (tool: string): ReadonlyArray<Held> =>
    PROVIDER_CATALOGUE.flatMap((spec) =>
        spec.abilities
            .filter((ability) => ability.tools.includes(tool))
            .map((ability) => ({ provider: spec.provider, ability })),
    )

/** True for a tool some ability holds: a provider right. */
export const isAbilityTool = (tool: string): boolean => holdersOf(tool).length > 0

/** True for an ability tool whose provider only the conversation tells: its executor asks, not the gateway. */
export const isChannelBound = (tool: string): boolean =>
    holdersOf(tool).some((held) => held.ability.channels !== undefined)

/** What an agent's attachments decide about one call of an ability tool. */
export type AbilityVerdict =
    | { readonly kind: "allow"; readonly provider: string; readonly ability: string }
    | { readonly kind: "approval"; readonly provider: string; readonly ability: string }
    | {
          readonly kind: "refuse"
          /** `not_attached`: the agent is attached to no provider that has the tool; `ability_off`: attached, the ability not ticked. */
          readonly reason: "not_attached" | "ability_off"
          /** The ability the call needs. */
          readonly ability: string
          /** The providers on which that ability would allow it. */
          readonly providers: ReadonlyArray<string>
      }

/**
 * The verdict of one call against the attachments of the calling agent, default deny, or null when the tool is no provider right (or,
 * for a channel-bound tool, when no provider is named: its executor asks once it knows the channel). The providers that have the tool
 * are the candidates (the one named, for a channel-bound tool). Attached to none: `not_attached`. Attached, the ability not ticked:
 * `ability_off`. Ticked: a read runs; a write runs by itself on `auto` and, on `ask`, only once a person approved this call. When
 * several attached providers hold the same provider-neutral tool, `ask` on any of them asks: the stricter tick wins.
 */
export const judgeAbility = (
    rows: ReadonlyArray<ProviderAttachmentView>,
    tool: string,
    approved: boolean,
    provider?: string,
): AbilityVerdict | null => {
    const holders = holdersOf(tool)
    const [first] = holders
    if (first === undefined) return null
    if (provider === undefined && first.ability.channels !== undefined) return null
    const candidates = provider === undefined ? holders : holders.filter((held) => held.provider === provider)
    const [candidate] = candidates
    if (candidate === undefined) return null
    const refusal = { ability: candidate.ability.id, providers: candidates.map((held) => held.provider) }
    const attached = candidates.flatMap((held) => {
        const row = rows.find((entry) => entry.provider === held.provider)
        return row === undefined ? [] : [{ ...held, mode: row.abilities[held.ability.id] }]
    })
    if (attached.length === 0) return { kind: "refuse", reason: "not_attached", ...refusal }
    const ticked = attached.flatMap((held) => (held.mode === undefined ? [] : [{ ...held, mode: held.mode }]))
    const [ready] = ticked
    if (ready === undefined) return { kind: "refuse", reason: "ability_off", ...refusal }
    const asking = ticked.find((held) => held.ability.scope === "write" && held.mode === "ask")
    if (asking !== undefined && !approved)
        return { kind: "approval", provider: asking.provider, ability: asking.ability.id }
    return { kind: "allow", provider: ready.provider, ability: ready.ability.id }
}

/** True when the attachment row lets some call of the tool through (ticked, whatever the mode). */
export const holdsTool = (row: ProviderAttachmentView, tool: string): boolean =>
    holdersOf(tool).some((held) => held.provider === row.provider && row.abilities[held.ability.id] !== undefined)

/** The mode a tick is stored in: a read ability has no `ask`, it is held or not. */
const storedMode = (ability: ProviderAbility, mode: AbilityMode): AbilityMode =>
    ability.scope === "read" ? "auto" : mode

/**
 * The ticks as a person below the owner may hold them: a write ability on `auto` becomes `ask` (only the owner lets an agent act on a
 * provider by itself); a read ability, which only reads, stays ticked.
 */
export const cappedTicks = (spec: ProviderSpec, ticks: AbilityTicks): AbilityTicks =>
    Object.fromEntries(
        Object.entries(ticks).map(([id, mode]): [string, AbilityMode] => [
            id,
            spec.abilities.find((ability) => ability.id === id)?.scope === "write" ? "ask" : mode,
        ]),
    )

/** True when the ticks hold a write ability on `auto`: more than a person below the owner may give. */
export const exceedsCeiling = (spec: ProviderSpec, ticks: AbilityTicks): boolean =>
    Object.entries(ticks).some(
        ([id, mode]) => mode === "auto" && spec.abilities.find((ability) => ability.id === id)?.scope === "write",
    )

/** The ticks a person asked for, as they are stored, or the first entry that is no ability of the provider or no valid mode. */
export type WishedTicks =
    | { readonly ok: true; readonly ticks: AbilityTicks }
    | { readonly ok: false; readonly ability: string }

/** The ticks a person asked for on a provider (`off` leaves an ability unticked), or the entry that cannot be stored. */
export const ticksOfWish = (spec: ProviderSpec, wish: Readonly<Record<string, string>>): WishedTicks => {
    const entries = Object.entries(wish).map(([id, mode]) => ({
        id,
        mode,
        ability: spec.abilities.find((entry) => entry.id === id),
    }))
    const bad = entries.find(
        (entry) => entry.ability === undefined || (entry.mode !== "off" && entry.mode !== "auto" && entry.mode !== "ask"),
    )
    if (bad !== undefined) return { ok: false, ability: bad.id }
    return {
        ok: true,
        ticks: Object.fromEntries(
            entries.flatMap((entry): Array<[string, AbilityMode]> =>
                entry.ability !== undefined && (entry.mode === "auto" || entry.mode === "ask")
                    ? [[entry.id, storedMode(entry.ability, entry.mode)]]
                    : [],
            ),
        ),
    }
}

/**
 * The ticks a module's declared defaults give a fresh agent on one provider, or null when the declaration names neither the provider's
 * kind nor the provider (the agent is not proposed it at all) or the provider has no ability. The provider's own entry replaces its
 * kind's, ability by ability; an ability the provider does not have is passed over, and `off` or an ability left out stays unticked.
 */
export const ticksOfTemplate = (template: ModuleAgentAbilities | undefined, spec: ProviderSpec): AbilityTicks | null => {
    const kind = template?.kinds?.[spec.kind]
    const own = template?.providers?.[spec.provider]
    if ((kind === undefined && own === undefined) || spec.abilities.length === 0) return null
    const wanted = { ...kind, ...own }
    return Object.fromEntries(
        spec.abilities.flatMap((ability): Array<[string, AbilityMode]> => {
            const mode = wanted[ability.id]
            return mode === "auto" || mode === "ask" ? [[ability.id, storedMode(ability, mode)]] : []
        }),
    )
}
