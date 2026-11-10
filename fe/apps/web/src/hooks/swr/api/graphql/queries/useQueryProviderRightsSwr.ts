"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryProviderRights } from "@/modules/api/graphql/queries/query-provider-rights"
import { answeredData, type ReadResponse } from "@/hooks/workspaceread"
import type { ProviderRightsQuery } from "@/modules/api"

/** The SWR key of the providerRights query. */
export const QUERY_PROVIDER_RIGHTS_SWR_KEY = "QUERY_PROVIDER_RIGHTS_SWR"

/** The providers of the shop with their abilities, and what is attached to every agent; nothing is read while `enabled` is false. */
export const useQueryProviderRightsSwr = (enabled = true): ReadResponse<ProviderRightsQuery["providerRights"]> =>
    useSWR(
        useWorkspaceKey(QUERY_PROVIDER_RIGHTS_SWR_KEY, [], enabled),
        async ({ signal }: { signal?: AbortSignal } = {}) =>
            answeredData(await queryProviderRights({ signal }), "providerRights").providerRights,
    )
