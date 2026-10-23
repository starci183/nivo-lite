import type { CredentialState } from "./mcp-connectors.contracts"

const STATES: ReadonlyMap<string, CredentialState> = new Map([
    ["none", "none"],
    ["needed", "needed"],
    ["set", "set"],
])

/** A stored credential state as the closed union; an unknown text reads as `needed`, so nothing is ever sent without a credential by mistake. */
export const credentialStateOf = (value: string): CredentialState => STATES.get(value) ?? "needed"
