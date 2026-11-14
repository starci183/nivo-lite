import { ProviderSandboxEntryEntity } from "./provider-sandbox-entry.entity"

export { ProviderSandboxEntryEntity }

/** The entities the provider-sandbox capability owns, for the app's connection. */
export const providerSandboxEntities: readonly [typeof ProviderSandboxEntryEntity] = [ProviderSandboxEntryEntity] as const
