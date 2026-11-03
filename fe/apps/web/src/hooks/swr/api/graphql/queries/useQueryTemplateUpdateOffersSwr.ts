"use client"

import useSWR from "swr"
import type { SWRResponse } from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import type { TemplateUpdateOffersData } from "@/modules/api/graphql"
import { queryTemplateUpdateOffers } from "@/modules/api/graphql/queries/query-template-update-offers"

/** The SWR key of {@link useQueryTemplateUpdateOffersSwr}. */
export const QUERY_TEMPLATE_UPDATE_OFFERS_SWR_KEY = "QUERY_TEMPLATE_UPDATE_OFFERS_SWR"

/** The back end `templateUpdateOffers` query. */
export const useQueryTemplateUpdateOffersSwr = (enabled = true): SWRResponse<TemplateUpdateOffersData, Error> =>
    useSWR(
        useWorkspaceKey(QUERY_TEMPLATE_UPDATE_OFFERS_SWR_KEY, [], enabled),
        async ({ signal }: { signal?: AbortSignal } = {}) => {
            const result = await queryTemplateUpdateOffers({ signal })
            if (!result.data) throw new Error("templateUpdateOffers answered no data")
            return result.data.templateUpdateOffers
        },
    )
