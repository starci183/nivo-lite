import { OPENAPI_PROVIDER, OPENAPI_SOURCE_KEYS } from "@modules/domain/openapi-tools"
import { PROVIDER_CATALOGUE, type ProviderSpec } from "./provider-abilities.policy"

/** What is read of a template agent (`defineTemplateAgent`): the providers it lists, as its nodes name them. */
export interface AgentAccountsSource {
    readonly accounts: ReadonlyArray<string>
}

/**
 * The provider of the catalogue that serves what a template agent lists under a key: the provider of that key; for a SOURCE key (`crm`),
 * the OpenAPI provider, whose accounts nodes name by the source their pinned document serves (`nodeProviderKeyOf`); none for `nivo`, a
 * key nothing serves, and a provider that serves no tool.
 */
const servingSpecOf = (
    provider: string,
    catalogue: ReadonlyArray<ProviderSpec>,
    sources: ReadonlyArray<string>,
): ProviderSpec | undefined => {
    const spec =
        catalogue.find((candidate) => candidate.provider === provider) ??
        (sources.includes(provider) ? catalogue.find((candidate) => candidate.provider === OPENAPI_PROVIDER) : undefined)
    return spec !== undefined && spec.abilities.length > 0 ? spec : undefined
}

/**
 * The providers a fresh agent of a template agent (`defineTemplateAgent`) is attached to (nivo-frame `rights`): one per provider of the
 * catalogue that serves a key the agent lists in `accounts`, in the agent's order (`nivo` and a key nothing serves pass over; a SOURCE key
 * such as `crm` is served by the OpenAPI provider). The creation, the seed and the connect page attach every working account of these;
 * nothing else is derived (no tick, no mode: a call's mode is its node's).
 */
export const providersOfTemplateAgent = (
    agent: AgentAccountsSource,
    catalogue: ReadonlyArray<ProviderSpec> = PROVIDER_CATALOGUE,
    sources: ReadonlyArray<string> = OPENAPI_SOURCE_KEYS,
): ReadonlyArray<string> => [
    ...new Set(
        agent.accounts.flatMap((named) => {
            const spec = servingSpecOf(named, catalogue, sources)
            return spec === undefined ? [] : [spec.provider]
        }),
    ),
]
