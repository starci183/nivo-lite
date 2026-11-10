import { makeFakeStore } from "./fakeStore"
import type { AbilityMode, AbilityScope, AttachmentWire, HeldAbilityWire, ProviderKind, ProviderRightsWire, ProviderWire } from "./providerRights.types"

/**
 * FAKE SOURCE for `providerRights` and its mutations (`attachAgentProvider`, `detachAgentProvider`, `setAgentAbility`), shaped as backend F10
 * fixed them (lanes/UI-NEEDS-API-20261110.md). The pretend shop and its abilities are the REAL ability table (lanes/ABILITIES-20261110.md).
 * Swap this ONE file for the GraphQL. The `moduleKey` argument is fake-only: it decides what a pretend agent starts with.
 */

/** Builds an ability whose label is its id (the app shows its own catalog text for the id). */
const ability = (id: string, scope: AbilityScope): ProviderWire["abilities"][number] => ({
    id,
    label: { vi: id, en: id },
    scope,
    tools: [],
})

/** Builds a provider whose label is its key (the app shows the brand). */
const provider = (key: string, kind: ProviderKind, connected: boolean, abilities: ProviderWire["abilities"]): ProviderWire => ({
    provider: key,
    label: { vi: key, en: key },
    kind,
    kindLabel: { vi: kind, en: kind },
    connected,
    abilities,
})

/** The providers of the pretend shop. Telegram is not connected here (the create dialog's dimmed line); Meta was disconnected after Sales got it. */
export const SHOP_PROVIDERS: ReadonlyArray<ProviderWire> = [
    provider("zalo_oa", "messaging", true, [ability("customer.send", "write")]),
    provider("telegram", "messaging", false, [ability("customer.send", "write")]),
    provider("meta", "messaging", false, [ability("customer.send", "write")]),
    provider("sepay", "payment", true, [
        ability("transactions.read", "read"),
        ability("credit.rematch", "write"),
        ability("qr.create", "write"),
    ]),
    provider("payos", "payment", true, []),
    provider("google", "books", true, [
        ability("ledger.read", "read"),
        ability("ledger.write", "write"),
        ability("drive.read", "read"),
    ]),
]

const held = (id: string, mode: HeldAbilityWire["mode"]): HeldAbilityWire => ({ id, mode })

/** The providers a pretend agent holds when it is first read, by template. */
const SEEDS: Readonly<Record<string, ReadonlyArray<Omit<AttachmentWire, "agentId">>>> = {
    sales: [
        { provider: "zalo_oa", abilities: [held("customer.send", "auto")] },
        { provider: "sepay", abilities: [held("qr.create", "auto")] },
        { provider: "meta", abilities: [held("customer.send", "ask")] },
    ],
    chatbot: [{ provider: "zalo_oa", abilities: [held("customer.send", "auto")] }],
    accounting: [
        { provider: "sepay", abilities: [held("transactions.read", "auto"), held("credit.rematch", "ask")] },
        { provider: "google", abilities: [held("ledger.read", "auto"), held("ledger.write", "ask")] },
    ],
}

/** The attachments of the agents somebody touched, by agent id. */
const store = makeFakeStore<Readonly<Record<string, ReadonlyArray<AttachmentWire>>>>({})

const seedOf = (agentId: string, moduleKey: string): ReadonlyArray<AttachmentWire> =>
    (SEEDS[moduleKey] ?? []).map((seed) => ({ agentId, ...seed }))

const attachmentsOf = (agentId: string, moduleKey: string): ReadonlyArray<AttachmentWire> =>
    store.get()[agentId] ?? seedOf(agentId, moduleKey)

const write = (agentId: string, next: ReadonlyArray<AttachmentWire>): void => store.set({ ...store.get(), [agentId]: next })

/** `providerRights`: the shop's providers and what the agent holds (the real query answers every agent's attachments). */
export const useFakeProviderRights = (agentId: string, moduleKey: string): ProviderRightsWire => {
    const all = store.use()
    return { providers: SHOP_PROVIDERS, attachments: all[agentId] ?? seedOf(agentId, moduleKey) }
}

/** `attachAgentProvider({ agentId, provider, abilities })`. */
export const fakeAttachAgentProvider = async (
    agentId: string,
    moduleKey: string,
    provider: string,
    abilities: ReadonlyArray<HeldAbilityWire>,
): Promise<void> => {
    const current = attachmentsOf(agentId, moduleKey)
    if (current.some((one) => one.provider === provider)) return
    write(agentId, [...current, { agentId, provider, abilities }])
}

/** `detachAgentProvider({ agentId, provider })`. */
export const fakeDetachAgentProvider = async (agentId: string, moduleKey: string, provider: string): Promise<void> => {
    write(
        agentId,
        attachmentsOf(agentId, moduleKey).filter((one) => one.provider !== provider),
    )
}

/** `setAgentAbility({ agentId, provider, ability, mode })`: `off` drops the ability from the attachment. */
export const fakeSetAgentAbility = async (
    agentId: string,
    moduleKey: string,
    provider: string,
    abilityId: string,
    mode: AbilityMode,
): Promise<void> => {
    write(
        agentId,
        attachmentsOf(agentId, moduleKey).map((one) => {
            if (one.provider !== provider) return one
            const others = one.abilities.filter((entry) => entry.id !== abilityId)
            return { ...one, abilities: mode === "off" ? others : [...others, { id: abilityId, mode }] }
        }),
    )
}
