import { makeFakeStore } from "./fakeStore"
import type { TemplateCandidateWire } from "./providerRights.types"

/**
 * FAKE SOURCE for `providerTemplateCandidates({ provider })` and `attachProviderByTemplate({ provider, agentIds })`, shaped as backend F10
 * fixed them. One pending provider: Telegram, just connected, for Sales and the receptionist. The candidates keep answering until the
 * provider is attached (the page, not the backend, remembers "Để sau"). Swap this ONE file for the GraphQL.
 */

/** The providers the pretend shop connected after its agents were made. */
export const FRESH_PROVIDERS: ReadonlyArray<string> = ["telegram"]

const AUTO = [{ id: "customer.send", mode: "auto" }] as const

const store = makeFakeStore<Readonly<Record<string, ReadonlyArray<TemplateCandidateWire>>>>({
    telegram: [
        { agentId: "fake-agent-sales", agentName: "Sales", module: "sales", abilities: AUTO },
        // The escapes spell the Vietnamese name of the receptionist without Vietnamese letters in source (names are server data).
        { agentId: "fake-agent-reception", agentName: "Lễ tân", module: "chatbot", abilities: AUTO },
    ],
})

/** `providerTemplateCandidates({ provider })` for each fresh provider. */
export const useFakeProviderTemplateCandidates = (): Readonly<Record<string, ReadonlyArray<TemplateCandidateWire>>> => store.use()

/** `attachProviderByTemplate({ provider, agentIds })`: attaches, so the candidates stop. */
export const fakeAttachProviderByTemplate = async (provider: string, agentIds: ReadonlyArray<string>): Promise<void> => {
    const left = (store.get()[provider] ?? []).filter((row) => !agentIds.includes(row.agentId))
    store.set({ ...store.get(), [provider]: left })
}
