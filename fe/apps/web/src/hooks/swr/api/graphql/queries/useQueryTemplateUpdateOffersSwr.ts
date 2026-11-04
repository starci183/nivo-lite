"use client"

import useSWR from "swr"
import { answeredData } from "@/hooks/workspaceread"
import type { SWRResponse } from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import type { TemplateUpdateOffersQuery } from "@/modules/api"
import { queryTemplateUpdateOffers } from "@/modules/api/graphql/queries/query-template-update-offers"

/** The SWR key of {@link useQueryTemplateUpdateOffersSwr}. */
export const QUERY_TEMPLATE_UPDATE_OFFERS_SWR_KEY = "QUERY_TEMPLATE_UPDATE_OFFERS_SWR"

/** The back end `templateUpdateOffers` query. */
export const useQueryTemplateUpdateOffersSwr = (
    enabled = true,
): SWRResponse<TemplateUpdateOffersQuery["templateUpdateOffers"], Error> =>
    useSWR(
        useWorkspaceKey(QUERY_TEMPLATE_UPDATE_OFFERS_SWR_KEY, [], enabled),
        async ({ signal }: { signal?: AbortSignal } = {}) =>
            answeredData(await queryTemplateUpdateOffers({ signal }), "templateUpdateOffers").templateUpdateOffers,
    )
