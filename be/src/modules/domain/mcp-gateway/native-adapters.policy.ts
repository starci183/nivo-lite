import type { NativeAdapter } from "./mcp-gateway.contracts"

/**
 * The adapters by connector key, in the order the keys first appear. An adapter an app adds under a key a default already holds
 * (SePay with its status tool) takes the default's place, so no connector is listed twice and the one that runs is the last given.
 */
export const withoutShadowed = (adapters: ReadonlyArray<NativeAdapter>): ReadonlyArray<NativeAdapter> => [
    ...new Map(adapters.map((adapter) => [adapter.manifest.key, adapter])).values(),
]
