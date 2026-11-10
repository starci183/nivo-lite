"use client"

import useSWR, { type SWRConfiguration } from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryProviderTemplateCandidates } from "@/modules/api/graphql/queries/query-provider-template-candidates"
import { answeredData, type ReadResponse } from "@/hooks/workspaceread"
import type { ProviderTemplateCandidatesQuery } from "@/modules/api"

/** The SWR key of the providerTemplateCandidates query. */
export const QUERY_PROVIDER_TEMPLATE_CANDIDATES_SWR_KEY = "QUERY_PROVIDER_TEMPLATE_CANDIDATES_SWR"

/** The candidates of one connected account: the agents that could get it by their template. */
interface AccountCandidates {
    readonly connectionId: string
    readonly candidates: ProviderTemplateCandidatesQuery["providerTemplateCandidates"]
}

/** The agents that could get each of the accounts by template (the operation takes one account, so it is asked for each in parallel). Pass `null` to wait for the accounts. */
export const useQueryProviderTemplateCandidatesSwr = (
    connectionIds: ReadonlyArray<string> | null,
): ReadResponse<AccountCandidates[]> =>
    useSWR<AccountCandidates[], Error, SWRConfiguration<AccountCandidates[], Error>>(
        useWorkspaceKey(QUERY_PROVIDER_TEMPLATE_CANDIDATES_SWR_KEY, [
            connectionIds === null ? null : connectionIds.join(","),
        ]),
        async ({ signal }: { signal?: AbortSignal } = {}) =>
            Promise.all(
                (connectionIds ?? []).map(async (connectionId) => ({
                    connectionId,
                    candidates: answeredData(
                        await queryProviderTemplateCandidates({ request: { connectionId }, signal }),
                        "providerTemplateCandidates",
                    ).providerTemplateCandidates,
                })),
            ),
    )
