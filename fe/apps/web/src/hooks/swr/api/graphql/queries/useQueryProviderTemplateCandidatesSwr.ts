"use client"

import useSWR, { type SWRConfiguration } from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryProviderTemplateCandidates } from "@/modules/api/graphql/queries/query-provider-template-candidates"
import { answeredData, type ReadResponse } from "@/hooks/workspaceread"
import type { ProviderTemplateCandidatesQuery } from "@/modules/api"

/** The SWR key of the providerTemplateCandidates query. */
export const QUERY_PROVIDER_TEMPLATE_CANDIDATES_SWR_KEY = "QUERY_PROVIDER_TEMPLATE_CANDIDATES_SWR"

/** The candidates of one provider: the agents that could get it by their template. */
interface ProviderCandidates {
    readonly provider: string
    readonly candidates: ProviderTemplateCandidatesQuery["providerTemplateCandidates"]
}

/** The agents that could get each of the providers by template (the operation takes one provider, so it is asked for each in parallel). Pass `null` to wait for the providers. */
export const useQueryProviderTemplateCandidatesSwr = (
    providers: ReadonlyArray<string> | null,
): ReadResponse<ProviderCandidates[]> =>
    useSWR<ProviderCandidates[], Error, SWRConfiguration<ProviderCandidates[], Error>>(
        useWorkspaceKey(QUERY_PROVIDER_TEMPLATE_CANDIDATES_SWR_KEY, [providers === null ? null : providers.join(",")]),
        async ({ signal }: { signal?: AbortSignal } = {}) =>
            Promise.all(
                (providers ?? []).map(async (provider) => ({
                    provider,
                    candidates: answeredData(
                        await queryProviderTemplateCandidates({ request: { provider }, signal }),
                        "providerTemplateCandidates",
                    ).providerTemplateCandidates,
                })),
            ),
    )
