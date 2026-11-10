import { SHOP_PROVIDERS } from "./fakeProviderRights"
import type { AbilityProposalWire, HeldAbilityWire } from "./providerRights.types"

/**
 * FAKE SOURCE for `agentAbilityProposal({ moduleKey })`: the connected providers the template names, with the abilities it ticks
 * (a tick of a core job is `auto`; paid or hard-to-undo abilities are left off). Swap this ONE file for the GraphQL.
 */
const PROPOSALS: Readonly<Record<string, ReadonlyArray<AbilityProposalWire>>> = {
    sales: [
        { provider: "zalo_oa", abilities: [{ id: "customer.send", mode: "auto" }] },
        { provider: "sepay", abilities: [{ id: "qr.create", mode: "auto" }] },
    ],
    chatbot: [{ provider: "zalo_oa", abilities: [{ id: "customer.send", mode: "auto" }] }],
    accounting: [
        { provider: "sepay", abilities: [{ id: "transactions.read", mode: "auto" }] },
        { provider: "google", abilities: [{ id: "ledger.read", mode: "auto" }] },
    ],
}

/** The proposal of a template: only providers the shop has connected. */
export const fakeAgentAbilityProposal = (moduleKey: string): ReadonlyArray<AbilityProposalWire> =>
    (PROPOSALS[moduleKey] ?? []).filter((row) => SHOP_PROVIDERS.some((one) => one.provider === row.provider && one.connected))

/**
 * FAKE-ONLY: the providers the template names that the shop has NOT connected. The real `agentAbilityProposal` answers connected providers
 * only, so the create dialog's dimmed "Chưa nối" line needs this from the backend (open question for F10).
 */
export const fakeTemplateUnconnectedProviders = (moduleKey: string): ReadonlyArray<string> =>
    moduleKey === "sales" || moduleKey === "chatbot" ? ["telegram"] : []

/** A tick as the dialog edits it. */
export type { HeldAbilityWire }
