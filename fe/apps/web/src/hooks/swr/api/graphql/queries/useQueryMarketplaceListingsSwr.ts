"use client"

import useSWR from "swr"
import { answeredData } from "@/hooks/workspaceread"
import type { SWRResponse } from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import type { MarketplaceListingsQuery } from "@/modules/api"
import { queryMarketplaceListings } from "@/modules/api/graphql/queries/query-marketplace-listings"

/** The SWR key of {@link useQueryMarketplaceListingsSwr}. */
export const QUERY_MARKETPLACE_LISTINGS_SWR_KEY = "QUERY_MARKETPLACE_LISTINGS_SWR"

/** The back end `marketplaceListings` query. */
export const useQueryMarketplaceListingsSwr = (
    enabled = true,
): SWRResponse<MarketplaceListingsQuery["marketplaceListings"], Error> =>
    useSWR(
        useWorkspaceKey(QUERY_MARKETPLACE_LISTINGS_SWR_KEY, [], enabled),
        async ({ signal }: { signal?: AbortSignal } = {}) =>
            answeredData(await queryMarketplaceListings({ signal }), "marketplaceListings").marketplaceListings,
    )
