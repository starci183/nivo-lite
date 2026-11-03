"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryMarketplaceListings } from "@/modules/api/graphql/queries/query-marketplace-listings"

/** The SWR key of {@link useQueryMarketplaceListingsSwr}. */
export const QUERY_MARKETPLACE_LISTINGS_SWR_KEY = "QUERY_MARKETPLACE_LISTINGS_SWR"

/** The back end `marketplaceListings` query. */
export const useQueryMarketplaceListingsSwr = (enabled = true) =>
    useSWR(
        useWorkspaceKey(QUERY_MARKETPLACE_LISTINGS_SWR_KEY, [], enabled),
        async ({ signal }: { signal?: AbortSignal } = {}) => {
            const result = await queryMarketplaceListings({ signal })
            if (!result.data) throw new Error("marketplaceListings answered no data")
            return result.data.marketplaceListings
        },
    )
