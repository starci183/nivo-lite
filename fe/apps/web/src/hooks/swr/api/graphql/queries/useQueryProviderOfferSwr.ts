"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { answeredData, type ReadResponse } from "@/hooks/workspaceread"
import { queryProviderOffer } from "@/modules/api/graphql/queries/query-provider-offer"
import type { ProviderOfferQuery } from "@/modules/api"

/** The SWR key of the three-level documentation of one connected account's provider. */
export const QUERY_PROVIDER_OFFER_SWR_KEY = "QUERY_PROVIDER_OFFER_SWR"

/**
 * What one connected account's provider offers (the back end `providerOffer` query): its reads, tools and triggers as documentation
 * from the registries, never a live provider call. Pass `null` while no account is open.
 */
export const useQueryProviderOfferSwr = (
    connectionId: string | null,
): ReadResponse<ProviderOfferQuery["providerOffer"]> =>
    useSWR(
        useWorkspaceKey(QUERY_PROVIDER_OFFER_SWR_KEY, [connectionId], connectionId !== null && connectionId !== ""),
        async ({ signal }: { signal?: AbortSignal } = {}) =>
            answeredData(await queryProviderOffer({ request: { connectionId: connectionId ?? "" }, signal }), "providerOffer")
                .providerOffer,
        { errorRetryCount: 1, revalidateOnFocus: false },
    )
